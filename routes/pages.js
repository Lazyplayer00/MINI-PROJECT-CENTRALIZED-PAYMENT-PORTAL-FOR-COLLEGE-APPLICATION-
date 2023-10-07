const express = require("express");

const router = express.Router();

router.get('/', (req,res) => {
    res.render('index');
});

router.get("/login", (req,res) => {
    res.render("login_page");
});

router.get("/userpage", (req,res) => {
    res.render("User_page");
});

router.get('/paymentHistory' , (req,res) => {
    res.render("payment_history");
})

router.get('/pdf' , (req,res) => {
    res.render("pdf_reciept");
})

module.exports = router;