const mongoose = require("mongoose");

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

const joinRequest = mongoose.model("JoinRequest", joinRequestSchema);

module.exports = joinRequest;
