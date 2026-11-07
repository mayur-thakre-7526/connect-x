const { success } = require("zod");
const Team = require("../models/Team.js");
const { createTeamSchema } = require("../utils/validators/team.validator.js");
const {
  discoverTeamsSchema,
} = require("../utils/validators/team.validator.js");

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

module.exports = { createTeam, discoverTeams };
