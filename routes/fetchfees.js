const express = require("express");
const fetchFeesController = require('../controllers/fetchfees')

const router = express.Router();

router.get('/fetchfees', fetchFeesController.fetchfees)

module.exports = router;