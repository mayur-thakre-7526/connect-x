const mongoose = require("mongoose");

const JOIN_REQUEST_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
  "left",
  "removed",
];

const statusHistorySchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      enum: JOIN_REQUEST_STATUSES,
      default: null,
    },

    toStatus: {
      type: String,
      enum: JOIN_REQUEST_STATUSES,
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

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
      enum: JOIN_REQUEST_STATUSES,
      default: "pending",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true },
);

// Prevent duplicate requests for the same team
joinRequestSchema.index({ team: 1, user: 1 }, { unique: true });

// Student's all applications
// Optimize all requests for a student
// Sorted newest first
joinRequestSchema.index({
  user: 1,
  createdAt: -1,
  _id: -1,
});

// Student's status-filtered applications
// Optimize req's filtered by status
// Sorted newest first
joinRequestSchema.index({
  user: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});

// Team's all received applications
// Optimize received join requests for a team
// Sorted newest first
joinRequestSchema.index({
  team: 1,
  createdAt: -1,
  _id: -1,
});

// Team's status-filtered applications
// Optimize received requests filtered by status
// Sorted newest first
joinRequestSchema.index({
  team: 1,
  status: 1,
  createdAt: -1,
  _id: -1,
});

const joinRequest = mongoose.model("JoinRequest", joinRequestSchema);

module.exports = joinRequest;
