const express = require("express");
const router = express.Router();

const { discoverStudents } = require("../controllers/discovery.controller.js");
const protect = require("../middleware/auth.middleware.js");


// Protected student discovery route
router.get("/discover", protect, discoverStudents);

module.exports = router;
