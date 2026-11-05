const Team = require("../models/Team.js");
const { createTeamSchema } = require("../utils/validators/team.validator.js");

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

module.exports = { createTeam };
