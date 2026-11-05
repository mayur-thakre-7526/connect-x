const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },

    role: {
      type: {
        type: String,
        enum: ["leader", "member"],
        default: "member",
      },
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const teamSchema = new mongoose.Schema(
  {
    teamName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    projectTitle: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    requiredSkills: {
      type: [String],
      default: [],
    },

    maxMembers: {
      type: Number,
      min: 2,
      max: 10,
      default: 5,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: {
      type: [teamMemberSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["recruiting", "closed"],
      default: "recruiting",
    },
  },
  { timestamps: true },
);

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
