const { success } = require("zod");
const mongoose = require("mongoose");
const Team = require("../models/Team.js");
const { createTeamSchema } = require("../utils/validators/team.validator.js");
const {
  discoverTeamsSchema,
} = require("../utils/validators/team.validator.js");

const JoinRequest = require("../models/JoinRequest.js");
const {
  createJoinRequestSchema,
} = require("../utils/validators/team.validator.js");
const joinRequest = require("../models/JoinRequest.js");

const createTeam = async (req, res) => {
  try {
    // 1. Validate req body
    const validationResult = createTeamSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: "Invalid team data",
        errors: validationResult.error.issues,
      });
    }

    const { teamName, description, projectTitle, requiredSkills, maxMembers } =
      validationResult.data;

    // 2. Create Team
    const team = await Team.create({
      teamName,
      description,
      projectTitle,
      requiredSkills,
      maxMembers,

      createdBy: req.user.userId,

      // Creator automatically becomes team leader
      members: [
        {
          user: req.user.userId,
          role: "leader",
        },
      ],
    });

    // 3. Populate user info
    await team.populate("createdBy", "name email college");

    await team.populate("members.user", "name email college");

    // 4. Return res
    return res.status(201).json({
      success: true,
      message: "Team created Successfully",
      team,
    });
  } catch (error) {
    console.error("Create team error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const discoverTeams = async (req, res) => {
  try {
    // 1. Validate query parameters
    const validationResult = discoverTeamsSchema.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: validationResult.error.issues,
      });
    }

    const { skill, status, page, limit } = validationResult.data;

    // 2. Build MongoDB query
    const query = {};

    if (skill) {
      query.requiredSkills = {
        $regex: skill,
        $options: "i",
      };
    }

    if (status) {
      query.status = status;
    }

    // 3. Calculate pagination
    const skip = (page - 1) * limit;

    // 4. Fetch temas and total count
    const [teams, totalTeams] = await Promise.all([
      Team.find(query)
        .populate("createdBy", "name email college")
        .populate("members.user", "name email college")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Team.countDocuments(query),
    ]);

    // 5. Calculate pagination info
    const totalPages = Math.ceil(totalTeams / limit);

    // 6. Return res
    return res.status(200).json({
      success: true,
      message: "Teams fetched successfully",
      pagination: {
        currentPage: page,
        limit,
        totalTeams,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      teams,
    });
  } catch (error) {
    console.error("Discover teams error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const sendJoinRequest = async (req, res) => {
  try {
    // 1. Validate req body
    const validationResult = createJoinRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.issues,
      });
    }

    const { message } = validationResult.data;

    // 2. Find the requested team
    const team = await Team.findById(req.params.teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // 3. Check whether team is recruiting
    if (team.status !== "recruiting") {
      return res.status(400).json({
        success: false,
        message: "This team is not accepting new members",
      });
    }

    // 4. Check whether user is already a member

    const isMember = team.members.some(
      (member) => member.user.toString() === req.user.userId,
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: "You are already a member of this team",
      });
    }

    // 5. Check whether team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "This team is already full",
      });
    }

    // 6. Check existing join req
    const existingRequest = await JoinRequest.findOne({
      team: team._id,
      user: req.user.userId,
    });

    if (existingRequest) {
      if (existingRequest.status === "pending") {
        return res.status(409).json({
          success: false,
          message: "You already have a pending request",
        });
      }
      if (existingRequest.status === "accepted") {
        return res.status(400).json({
          success: false,
          message: "Your request has already benn accepted",
        });
      }

      // Allow resubmission after rejection
      existingRequest.message = message;
      existingRequest.status = "pending";
      existingRequest.reviewedAt = null;

      await existingRequest.save();

      return res.status(200).json({
        success: true,
        message: "Join request resubmitted successfully",
        joinRequest: existingRequest,
      });
    }

    // 7. Create a new join request
    const joinRequest = await JoinRequest.create({
      team: team._id,
      user: req.user.userId,
      message,
    });

    // 8. Return response
    return res.status(201).json({
      success: true,
      message: "Join request sent successfully",
      joinRequest,
    });
  } catch (error) {
    console.error("Send join request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getTeamJoinRequests = async (req, res) => {
  try {
    // 1. Validate team ID
    if (!mongoose.Types.ObjectId.isValid(req.params.teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // 2. Find the team
    const team = await Team.findById(req.params.teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // 3. Check whether logged-in user is the team leader
    if (team.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the team leader can view join requests",
      });
    }

    // 4. Fetch join requests
    const joinRequests = await JoinRequest.find({
      team: team._id,
    })
      .populate("user", "name email college branch graduationYear skills")
      .sort({ createdAt: -1 })
      .lean();

    // 5. Return response
    return res.status(200).json({
      success: true,
      message: "Join requests fetched successfully",
      team: {
        id: team._id,
        teamName: team.teamName,
      },
      totalRequests: joinRequests.length,
      joinRequests,
    });
  } catch (error) {
    console.error("Get team join requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createTeam,
  discoverTeams,
  sendJoinRequest,
  getTeamJoinRequests,
};
