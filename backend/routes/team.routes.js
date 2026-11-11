const express = require("express");
const router = express.Router();

const {
  createTeam,
  discoverTeams,
  sendJoinRequest,
  getTeamJoinRequests,
  reviewJoinRequest,
  getMyTeams,
} = require("../controllers/team.controller.js");
const protect = require("../middleware/auth.middleware.js");

// Create a new team (Protected Route)
router.post("/", protect, createTeam);

// Discover teams (Protected Route)
router.get("/discover", protect, discoverTeams);

// Get logged-in user's teams (Protected Route)
router.get("/my-teams", protect, getMyTeams);


// Send join request (Protected Route)
router.post("/:teamId/join-requests", protect, sendJoinRequest);

// Get join requests (Protected Route)
router.get("/:teamId/join-requests", protect, getTeamJoinRequests);

// Accept/Reject join req (Protected Route)
router.patch("/:teamId/join-requests/:requestId", protect, reviewJoinRequest);

module.exports = router;
