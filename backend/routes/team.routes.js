const express = require("express");
const router = express.Router();

const {
  createTeam,
  discoverTeams,
  sendJoinRequest,
} = require("../controllers/team.controller.js");
const protect = require("../middleware/auth.middleware.js");

// Create a new team (Protected Route)
router.post("/", protect, createTeam);

// Discover teams (Protected Route)
router.get("/discover", protect, discoverTeams);

// Send join request (Protected Route)
router.post("/:teamId/join-requests", protect, sendJoinRequest);

module.exports = router;
