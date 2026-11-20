const express = require("express");
const router = express.Router();

const {
  createTeam,
  discoverTeams,
  sendJoinRequest,
  getTeamJoinRequests,
  reviewJoinRequest,
  getMyTeams,
  updateTeam,
  deleteTeam,
  leaveTeam,
  removeTeamMember,
  updateRecruitmentStatus,
  getTeamById,
  getMyTeamJoinRequest,
  getMyJoinRequests,
  withdrawJoinRequest,
} = require("../controllers/team.controller.js");

const protect = require("../middleware/auth.middleware.js");

// Create a new team (Protected Route)
router.post("/", protect, createTeam);

// Discover teams (Protected Route)
router.get("/discover", protect, discoverTeams);

// Get logged-in user's teams (Protected Route)
router.get("/my-teams", protect, getMyTeams);

// Get all join requests sent by logged-in student
router.get("/my-join-requests", protect, getMyJoinRequests);

// Get Team by Id
router.get("/:teamId", protect, getTeamById);

// Send join request (Protected Route)
router.post("/:teamId/join-requests", protect, sendJoinRequest);

// Logged-in student's own req status
router.get("/:teamId/join-requests/me", protect, getMyTeamJoinRequest);

// Withdraw current student's pending join request
router.delete("/:teamId/join-requests/me", protect, withdrawJoinRequest);

// Get join requests (Protected Route)
router.get("/:teamId/join-requests", protect, getTeamJoinRequests);

// Accept/Reject join req (Protected Route)
router.patch("/:teamId/join-requests/:requestId", protect, reviewJoinRequest);

// Update team recruitment status
router.patch("/:teamId/recruitment", protect, updateRecruitmentStatus);

// Update team details (Protected Route)
router.patch("/:teamId", protect, updateTeam);

// Delete a team (Only team creator)
router.delete("/:teamId", protect, deleteTeam);

// Leave a team (Only existing members)
router.delete("/:teamId/members/me", protect, leaveTeam);

// Remove a team member (Only team creator)
router.delete("/:teamId/members/:memberId", protect, removeTeamMember);

//

module.exports = router;
