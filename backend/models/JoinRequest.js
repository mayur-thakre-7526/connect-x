const mongoose = require("mongoose");
const { createTeam } = require("../controllers/team.controller");

const joinRequestSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Types.ObjectId,
      ref: "Team",
      require: true,
    },

    user: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      require: true,
    },

    message: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timeseries: true },
);

// One req record per user per team
joinRequestSchema.index({ team: 1, user: 1 }, { unique: true });

// Optimize all requests for a student
// Sorted newest first
joinRequestSchema.index({
  user: 1,
  createdAt: -1,
  _id: -1,
});

// Optimize req's filtered by status
// Sorted newest first
joinRequestSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});

const joinRequest = mongoose.model("JoinRequest", joinRequestSchema);

module.exports = joinRequest;
