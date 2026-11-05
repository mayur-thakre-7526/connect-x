const express = require("express");
const router = express.Router();

const { discoverStudets } = require("../controllers/discovery.controller.js");
const protect = require("../middleware/auth.middleware.js");

// Protected student discovery route
router.get("/discover", protect, discoverStudets);

module.exports = router;
