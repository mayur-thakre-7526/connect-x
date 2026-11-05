const express = require("express");
const {
  registerUser,
  loginUser,
  getMe,
  updateProfile,
} = require("../controllers/auth.controller.js");

const protect = require("../middleware/auth.middleware.js");

const router = express.Router();

// POST /api/auth/register
router.post("/register", registerUser);

// POST /api/auth/login
router.post("/login", loginUser);

// GET /api/auth/me
router.get("/me", protect, getMe);

// PUT /api/auth/profile
router.put("/profile", protect, updateProfile)

module.exports = router;
