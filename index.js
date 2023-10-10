const ejs = require('ejs');
const paypal = require('paypal-rest-sdk');
const express = require('express')
const bodyParser = require('body-parser')
const urlencodedParser = bodyParser.urlencoded({extended: false});
const path = require('path')
let address;
var formidable=require('formidable')
var fs=require('fs')

const mongoose = require('mongoose')
const User = require('./model/user')
const Admin = require('./model/admin')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const passwordValidator = require('password-validator');
const port=process.env.PORT ||3000;
const uri = "mongodb+srv://rashestebek:rash2003@cluster0.3auqma2.mongodb.net/Demal_db?retryWrites=true&w=majority"
let mongodb=require ('mongodb');
// let dotenv = require('dotenv').config();
let isAuth = false;
let isAdmin = false;
let gUsername;
let schema = new passwordValidator();
schema
    .is().min(8)
    .is().max(100)
    .has().uppercase()
    .has().lowercase()
    .has().not().spaces()
    .has().symbols();

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    family:4
})
let mongoClient = new mongodb.MongoClient(uri, {
    useUnifiedTopology: true
});
let app= express()
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/api')))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))













// PAYPAL

paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': 'AaU8tQfmz1_MFDTKuf84yYERXvdDt2ZFJVrxhNW_49DazF4A_F0VBuKyV5_nntyEdZqUa5Oq9ZBj65GV',
    'client_secret': 'EAZ8aFDU4lHHLy1bQqULYWqznf3dBknXZW3AH__zFC0bUs8AGUyR6RNbm-jHvqtikX7PsSqMO5vxuvKm'
});

app.post('/pay', (req, res) => {
    const create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://localhost:3000/success",
            "cancel_url": "http://localhost:3000/cancel"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": "Red Sox Hat",
                    "sku": "001",
                    "price": "25.00",
                    "currency": "USD",
                    "quantity": 1
                }]
            },
            "amount": {
                "currency": "USD",
                "total": "25.00"
            },
            "description": "Hat for the best team ever"
        }]
    };

    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
            throw error;
        } else {
            for(let i = 0;i < payment.links.length;i++){
                if(payment.links[i].rel === 'approval_url'){
                    res.redirect(payment.links[i].href);
                }
            }
        }
    });

});

app.get('/success', (req, res) => {
    const payerId = req.query.PayerID;
    const paymentId = req.query.paymentId;

    const execute_payment_json = {
        "payer_id": payerId,
        "transactions": [{
            "amount": {
                "currency": "USD",
                "total": "25.00"
            }
        }]
    };

    paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
        if (error) {
            console.log(error.response);
            throw error;
        } else {
            console.log(JSON.stringify(payment));
            res.send('Success');
        }
    });
});

app.get('/cancel', (req, res) => res.send('Cancelled'));

// PAYPAL










app.get('/login', function (req,res){
    if(isAuth){
        res.redirect('/')
    }
    res.sendFile(path.join(__dirname+'/api/login.html'))
})

app.post('/login', async function (req,res){
    const { username, password } = req.body
    let admin =await Admin.findOne({username}).lean()
    if(admin && password === admin.password){
        isAdmin = true
        isAuth = true
        return res.json({ status: 'ok' })
    }
    const user = await User.findOne({ username }).lean()
    if(!user){
        return res.json({ status: 'error', error: 'Invalid username' })
    }
    if(password !== user.password){
        return res.json({ status: 'error', error: 'Incorrect password' })
    }
    isAuth = true;
    gUsername = username;
    res.json({status:"ok"})
})

app.get ('test', function (req,res){
    res.render('index')
})
app.get('/register', function (req,res){
    if(isAuth){
        res.redirect('/')
    }
    res.sendFile(path.join(__dirname+'/api/registration.html'))
})

app.post('/register', async function (req,res){
    let username = req.body.username
    let password = req.body.password
    let email = req.body.email
    let city = req.body.city
    let valid = schema.validate(password, {list: true});
    if(valid.length!=0){
        let msg = '';
        if(valid.includes('min')){
            msg = "Password must be longer than 7 characters \n";
        }
        if(valid.includes('lowercase')){
            msg = msg + "Password must contain lowercase letters \n";
        }
        if(valid.includes('uppercase')){
            msg = msg + "Password must must contain uppercase letters \n";
        }
        if(valid.includes('symbols')){
            msg = msg + "Password must contain symbols \n";
        }
        console.log(msg)
        return res.json({
            status: 'error',
            error: msg
        })
    }
    try {
        const response = await User.create({
            username,
            password,
            city,
            email
        })
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ status: 'error', error: 'Username already in use' })
        }
        throw error
    }
    isAuth = true;
    gUsername = username;
    res.json({ status: 'ok'})

});
mongoClient.connect(async function(error, mongo) {
    if (!error) {

        app.get('/users',async function(req, res) {
            if(!isAdmin){
                res.redirect('/')
            }
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let coll2 = db.collection("messages");
            let users = await coll.find().sort({username:1}).toArray();
            let messages = await coll2.find().toArray();
            console.log(messages)
            res.render('users', {users: users, messages: messages});
        });

        app.get('/rate',async function(req, res) {
            if(!isAuth){
                res.redirect('/')
            }
            let db = mongo.db('Demal_db');
            let coll = db.collection('review');
            let User=gUsername;
            let users=await coll.find().toArray();
            res.render('review',{users:users,User});
        });
        app.post("/contact_us", (req,res)=>{
            console.log(req.body)
            let db = mongo.db('Demal_db');
            db.collection("messages").insertOne(req.body, function (err,res){})
            res.redirect('/contact_us')
        })
        app.post("/users", function (req,res) {
            let db = mongo.db('Demal_db');
            let a = req.body;
            a.title.push(address);
            db.collection("posts").insertOne(a, function (error, document) {
                console.log(error)
                address=null;
                res.redirect('/users');
            });
        });
        app.get('/', function(req, res) {
            if(isAdmin){
                res.redirect('/users')
            }
            db.collection("posts").find().toArray(function (err, posts){
                res.render('indexFull',{posts:posts, isAuth: isAuth});
            });

        })
        app.get('/contact_us', function(req, res) {
            res.render('contact_us');
        })

        app.get('/news_general', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/NewsGeneral.html'))
        })
        app.get('/1news', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/1news.html'))
        })
        app.get('/2news', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/2news.html'))
        })
        app.get('/3news', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/3news.html'))
        })
        app.get('/4news', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/4news.html'))
        })
        app.get('/5news', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/5news.html'))
        })

        app.get('/Hacks&Blogs', function(req, res) {
            res.sendFile(path.join(__dirname+'/api/Hacks&Blogs.html'))
        })

        app.post("/do-upload-image",function(req,res){
            let formData = new formidable.IncomingForm();
            formData.parse(req,function(error,fields,files){
                let oldPath = files.file.filepath;
                let newPath = "api/imagesUploaded/" + files.file.newFilename+".jpeg";
                fs.rename(oldPath,newPath,function (err){
                    console.log(newPath)
                    let ipath = newPath
                    let db = mongo.db('Demal_db');
                    address = newPath;
                    res.send("/"+newPath);
   });

});
        });
        app.get('/reviews',async function(req, res) {
            if(!isAuth){
                res.redirect('/')
            }
            let db = mongo.db('Demal_db');
            let coll = db.collection('review');
            let users=await coll.find().toArray();
            res.render('reviews',{users:users});
        });
        app.post('/rate',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('review');
            let user=req.body;
            let users=await coll.insertOne(user);
            let es=await coll.updateMany({rate1:"on"},{$set:{"class":"rate-1"}})
            let es1=await coll.updateMany({rate2:"on"},{$set:{"class":"rate-2"} })
            let es2=await coll.updateMany({rate3:"on"},{$set:{"class":"rate-3"} })
            let es3=await coll.updateMany({rate4:"on"},{$set:{"class":"rate-4"} })
            let es4=await coll.updateMany({rate5:"on"},{$set:{"class":"rate-5"} })
            res.redirect('/');
        });
        app.get('/user/delete/:username', async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let name = req.params.username;
            let user = await coll.deleteOne({username: name});
            res.redirect('/users');
        });
        app.get('/user/add', function(req, res) {
            res.render('add');
        });
        app.post('/user/add', async function(req, res) {
            delete req.body._id;
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let user=req.body;
            let result= await coll.insertOne(user);
            res.redirect('/users');
        });
        app.get('/user/edit/:username',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let name= req.params.username;
            let user = await coll.findOne({username: name});
            res.render('edit', {user});
        });
        app.post('/user/edit/:username', async function(req, res) {
            delete req.body._id;
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let user = req.body;
            let resuk= await coll.updateOne({username: user.username}, {$set: user});
            res.redirect('/users');
        });
        app.get('/seats',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let users= await coll.find().sort({id:1}).toArray();
            res.render('table',{users:users});
        });
        app.post('/seats', async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('orders');
            let user=req.body;
            let result= await coll.insertOne(user);
            res.redirect('/');
        });
        app.get('/seats/restore',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let users= await coll.find({class:"seat sold"}).sort({id:1}).toArray();
            res.render('restore',{users:users});
        });
        app.post('/seats/restore',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let users= await coll.updateMany({class:"seat sold"},{$set:{class:"seat"}});
            res.redirect('/');
        });
        app.get('/seats/change/:id',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let name= req.params.id;
            let username=gUsername;
            let users= await coll.findOne({id:name});
            res.render('change',{users,username});
        });
        app.post('/seats/change/:id',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let coll1 = db.collection('orders');
            let user=req.body;
            let a=req.body;
            let result= await coll1.insertOne(user);
            let users= await coll.updateOne({id:a.id},{$set:{class:"seat selected"}});
            res.redirect('/');
        });
        app.get('/admin/seat/chang',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll1 =db.collection('orders');
            let orr=await coll1.find().toArray();
            res.render('adminconfirm',{orr:orr});
        });
        app.post('/admin/seat/chang',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll = db.collection('seats');
            let coll1=db.collection('ordersold')
            let coll2 =db.collection('orders');
            let a=req.body;
            let users= await coll.updateOne({id:a.id},{$set:{class:"seat sold"}});
            let resss=await coll2.deleteOne({id:a.id});
            let ress=await coll1.insertOne(a);
            res.redirect('/');
        });
        app.get('/answer',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll = db.collection('messages');
            let users= await coll.find().sort({id:1}).toArray();
            res.render('answer',{users:users});
        });
        app.post('/answer',async function(req,res){
            let db = mongo.db('Demal_db');
            let coll = db.collection('messages');
            let a=req.body;
            let users= await coll.updateOne({title:a.title},{$push:{answer:a.answer}});
            res.redirect('/');
        });
        app.get('/messages',async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('messages');
            let users= await coll.find().sort({id:1}).limit(3).toArray();
            res.render('messages',{users:users});
        });
        app.post('/messages', async function(req, res) {
            let db = mongo.db('Demal_db');
            let coll = db.collection('messages');
            let user=req.body;
            let result= await coll.insertOne(user);
            res.redirect('/');
        });
        app.get("/profile", async function (req, res){
            if(!isAuth){
                res.redirect('/')
            }
            let db = mongo.db('Demal_db');
            let coll = db.collection('ordersold');
            let username = gUsername;
            let users=await coll.find({name:username}).toArray();
            let user = await User.findOne({ username }).lean()
            res.render('profile', {user:user,users:users})
        });
        app.post("/profile", async function(req, res){
            delete req.body._id;
            let db = mongo.db('Demal_db');
            let coll = db.collection('users');
            let user = req.body;
            let resuk= await coll.updateOne({username: user.username}, {$set: user});
            res.redirect('/profile');
        });
        let db = mongo.db('Demal_db');
        let coll = db.collection('users');
    } else {
        console.error(error);
    }
});
app.get("/logout", function (req,res){
    isAuth = false
    isAdmin = false
    gUsername = null
    res.redirect("/")
})
app.get("/tourOperator", function (req,res){
    res.render("/tourOperator");
})
app.listen(port, function() {
    console.log('Database Connected Successfully!');
});