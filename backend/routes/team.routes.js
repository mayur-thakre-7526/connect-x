const express = require("express");
const router = express.Router();

const { createTeam } = require("../controllers/team.controller.js");
const protect = require("../middleware/auth.middleware.js");

// Create a new team (Protected Route)
router.post("/", protect, createTeam);

module.exports = router;
