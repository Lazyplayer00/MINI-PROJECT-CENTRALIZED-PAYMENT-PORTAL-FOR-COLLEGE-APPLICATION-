const express = require("express");
const mysql = require("mysql");
const dotenv = require("dotenv");
const path = require("path");
const exp = require("constants");
const cors = require('cors');
const cookieParser = require('cookie-parser');
const app = express();

dotenv.config({path: './.env' })

const publicDirectory = path.join(__dirname, './public' );

app.use(express.static(publicDirectory));
app.use(cookieParser());//ITs self
app.use(cors());//For Middleware CORS
app.use(express.urlencoded({extended: false}));//For POST 
app.use(express.json());//Json parsing

const db = mysql.createConnection({
    
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DATABASE
    
})


app.set('view engine' , 'hbs');


db.connect( (error) =>{
    if (error) {
        console.log(error)
    } 
    else{
        console.log("Database is Connected")
    }
} )


//Router 
app.use('/', require('./routes/pages'))
app.use('/auth' , require('./routes/auth'))


app.listen(3000,() => {
    console.log("Server is on port http://localhost:3000");
})