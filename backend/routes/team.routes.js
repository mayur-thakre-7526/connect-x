const express = require("express");
const router = express.Router();

const {
  createTeam,
  discoverTeams,
  sendJoinRequest,
  getTeamJoinRequests,
} = require("../controllers/team.controller.js");
const protect = require("../middleware/auth.middleware.js");

// Create a new team (Protected Route)
router.post("/", protect, createTeam);

// Discover teams (Protected Route)
router.get("/discover", protect, discoverTeams);

// Send join request (Protected Route)
router.post("/:teamId/join-requests", protect, sendJoinRequest);

// Get join requests (Protected Route)
router.get("/:teamId/join-requests", protect, getTeamJoinRequests);

module.exports = router;
