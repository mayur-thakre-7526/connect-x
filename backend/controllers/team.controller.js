const { success } = require("zod");
const mongoose = require("mongoose");
const Team = require("../models/Team.js");
const {
  createTeamSchema,
  discoverTeamsSchema,
  createJoinRequestSchema,
  updateTeamSchema,
  updateRecruitmentStatusSchema,
} = require("../utils/validators/team.validator.js");

const JoinRequest = require("../models/JoinRequest.js");

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

    // validate team id
    const { teamId } = req.params;

    // Validate MongoDB ObjID
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // 2. Find the requested team
    const team = await Team.findById(teamId);

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
      // Case 1: Request already pending
      if (existingRequest.status === "pending") {
        return res.status(409).json({
          success: false,
          message: "You already have a pending request",
        });
      }

      // Case 2: Request already accepted
      if (existingRequest.status === "accepted") {
        return res.status(400).json({
          success: false,
          message: "Join request is already accepted",
        });
      }

      // Case 3: Student was removed by leader
      if (existingRequest.status === "removed") {
        return res.status(403).json({
          success: false,
          message:
            "You were removed from this team and cannot reaaply at this time",
        });
      }

      // Case 4: Reapply after rejection or leaving
      if (["rejected", "left", "withdrawn"].includes(existingRequest.status)) {
        // step 1: Preserve previous status
        const previousStatus = existingRequest.status;

        // step 2: Update req
        existingRequest.status = "pending";

        // Use the validated request message
        existingRequest.message = message;

        // Clear the previous reivew timestamp
        existingRequest.reviewedAt = null;

        // step 3: Record reapplication transition
        existingRequest.statusHistory.push({
          fromStatus: previousStatus,
          toStatus: "pending",
          changedBy: userId,
          changedAt: new Date(),
        });

        // step 4: Save status and history together
        await existingRequest.save();

        return res.stats(200).json({
          success: true,
          message: "Join request submitted again successfully",
          request: existingRequest,
        });
      }

      // Reject any other unsupported lifecycle state
      return res.status(409).json({
        success: false,
        message: "This join request cannot be resubmitted",
      });
    }

    // 7. Create a new join request
    const joinRequest = await JoinRequest.create({
      team: team._id,
      user: req.user.userId,
      message,
      status: "pending",

      // Record initial application event
      statusHistory: [
        {
          fromStatus: null,
          toStatus: "pending",
          changedBy: userId,
          changedAt: new Date(),
        },
      ],
    });

    // 8. Return response
    return res.status(201).json({
      success: true,
      message: "Join request sent successfully",
      joinRequest,
    });
  } catch (error) {
    // Handle MongoDB duplicate key error

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already send a join request to this team",
      });
    }
    console.error("Send join request error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getTeamJoinRequests = async (req, res) => {
  try {
    const { teamId } = teq.params;
    const userId = req.user.userId;

    // 1. Validate team ID
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // Step 2: Check if team exists
    const team = await Team.findById(teamId).select("createdBy teamName");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Step 3: Only creator can view applications
    if (team.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can view join requests",
      });
    }

    // Step 4: Read query parameters
    const { status = "all", page = "1", limit = "10" } = req.query;

    // Step 5: Validate status
    const allowedStatuses = [
      "all",
      "pending",
      "accepted",
      "rejected",
      "withdrawn",
      "left",
      "removed",
    ];

    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter",
      });
    }

    // Step 6: Validate pagination
    const isPositiveInteger = (value) =>
      typeof value === "string" &&
      /^[1-9]\d*$/.test(value) &&
      Number.isSafeInteger(Number(value));

    if (!isPositiveInteger(page) && !isPositiveInteger(limit)) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (limitNumber > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot exceed 50",
      });
    }

    // step 7: Calculate pagination offset
    const skip = (pageNumber - 1) * limitNumber;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        success: false,
        message: "Pagination offset is too large",
      });
    }

    // step 8: Build MongoDB filter
    const filter = {
      team: teamId,
    };

    if (status !== "all") {
      filter.status = status;
    }

    // step 9: Fetch applications and count

    const [joinRequests, statusCounts] = await Promise.all([
      // Query 1: Fetch filtered and paginated applications
      JoinRequest.find(filter)
        .populate(
          "user",
          "name college branch skills preferredRole bio github linkedin",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      // Query 2: Count ALL applications for this team
      JoinRequest.aggregate([
        {
          $match: {
            team: team._id,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Initialize statistics
    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      left: 0,
      removed: 0,
    };

    // Process MongoDB aggregation results
    for (const item of statusCounts) {
      stats.total += item.count;

      if (
        Object.prototype.hasOwnProperty.call(stats, item._id) &&
        item._id !== "total"
      ) {
        stats[item._id] = item.count;
      }
    }

    // Calculate total matching the selected filter
    const totalRequests = status === "all" ? stats.total : stats[status];

    // step 10: calculte pagination metadata
    const totalPages = Math.ceil(totalRequests / limitNumber);

    // Step 11: Return results

    return res.status(200).json({
      success: true,
      message: "Team join requests fetched successfully",
      teamId: team._id,
      appliedFilter: status,

      // Global team application statistics
      stats,

      // Count matching the selected filter
      totalRequests,

      pagination: {
        currentPage: pageNumber,
        totalPages,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1 && totalPages > 0,
      },

      // Current page applications
      requests: joinRequests,
    });
  } catch (error) {
    console.error("Get Team join requests Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team join requests",
    });
  }
};

const reviewJoinRequest = async (req, res) => {
  try {
    const { teamId, requestId } = req.params;
    const reviewerId = req.user.userId.toString();
    const { status } = req.body || {};

    // Step 1: Validate MongoDB IDs
    if (
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(requestId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID or request ID",
      });
    }

    // Step 2: Validate review status
    if (
      !req.body ||
      Object.keys(req.body).length !== 1 ||
      !["accepted", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Status must be accepted or rejected",
      });
    }

    // Helper for business validation errors
    const fail = (statusCode, message) => {
      const error = new Error(message);
      error.statusCode = statusCode;
      throw error;
    };

    // Step 3: Start MongoDB session
    const session = await mongoose.startSession();

    let updatedRequest;

    try {
      await session.withTransaction(async () => {
        // Step 4: Fetch team inside transaction
        const team = await Team.findById(teamId).session(session);

        if (!team) {
          fail(404, "Team not found");
        }

        // Step 5: Verify team creator
        if (team.createdBy.toString() !== reviewerId) {
          fail(403, "Only the team creator can review requests");
        }

        // Step 6: Fetch request inside transaction
        const joinRequest = await JoinRequest.findOne({
          _id: requestId,
          team: teamId,
        }).session(session);

        if (!joinRequest) {
          fail(404, "Join request not found");
        }

        // Step 7: Prevent duplicate review
        if (joinRequest.status !== "pending") {
          fail(409, "Join request already reviewed");
        }

        // Step 8: Handle acceptance
        if (status === "accepted") {
          if (team.status !== "recruiting") {
            fail(400, "Team is not recruiting");
          }

          if (team.members.length >= team.maxMembers) {
            fail(400, "Team is full");
          }

          // Ensure applicant is not already a member
          const alreadyMember = team.members.some(
            (member) => member.user.toString() === joinRequest.user.toString(),
          );

          if (alreadyMember) {
            fail(409, "Applicant is already a team member");
          }

          // Add accepted student
          team.members.push({
            user: joinRequest.user,
            role: "member",
          });

          // Update team capacity status
          if (team.members.length >= team.maxMembers) {
            team.status = "full";
          }

          // Save team within transaction
          await team.save({ session });
        }

        // Step 9: Update JoinRequest status
        const reviewTime = new Date();

        joinRequest.status = status;
        joinRequest.reviewedAt = reviewTime;

        // Step 10: Record lifecycle event
        joinRequest.statusHistory.push({
          fromStatus: "pending",
          toStatus: status,
          changedBy: reviewerId,
          changedAt: reviewTime,
        });

        // Save request within same transaction
        await joinRequest.save({ session });

        updatedRequest = joinRequest;
      });
    } finally {
      // Always release the session
      await session.endSession();
    }

    // Step 11: Respond only after successful commit
    return res.status(200).json({
      success: true,
      message: `Join request ${status} successfully`,
      request: updatedRequest,
    });
  } catch (error) {
    // Handle expected business errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Review Join Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to review join request",
    });
  }
};

const getMyTeams = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [createdTeams, joinedTeams] = await Promise.all([
      Team.find({ createdBy: userId })
        .populate("createdBy", "name email college")
        .populate("members.user", "name email college")
        .sort({ createdAt: -1 })
        .lean(),

      Team.find({
        "members.user": userId,
        createdBy: { $ne: userId },
      })
        .populate("createdBy", "name email college")
        .populate("members.user", "name email college")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      totalCreated: createdTeams.length,
      totalJoined: joinedTeams.length,
      createdTeams,
      joinedTeams,
    });
  } catch (error) {
    console.error("Get My Teams Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your teams",
    });
  }
};

const updateTeam = async (req, res) => {
  try {
    // 1. Validate request body
    const result = updateTeamSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.issues.map((issue) => issue.message),
      });
    }

    const { teamId } = req.params;

    // validate MongoDB objectId
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // 2. Find team
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // 3. Only team creator can update
    if (team.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can update this team",
      });
    }

    const updateData = result.data;

    // 4. Prevent maxMembers  below current members
    if (
      updateData.maxMembers !== undefined &&
      updateData.maxMembers < team.members.length
    ) {
      return res.status(400).json({
        success: false,
        message: `Maximum members cannot be less than current mombers (${team.members.length})`,
      });
    }

    // 5. Update team fields
    Object.assign(team, updateData);

    // when leader change maxMembers then automatically change the recruiting status

    if (updateData.maxMembers !== undefined && team.status !== "closed") {
      if (team.members.length >= team.maxMembers) {
        team.status = "full";
      } else {
        team.status = "recruiting";
      }
    }

    // 6. Save updated team
    await team.save();

    // 7. Return updated team
    const updatedTeam = await Team.findById(team._id)
      .populate("createdBy", "name email college")
      .populate("members.user", "name email college")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Update Team Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update team",
    });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const { teamId } = req.params;

    // Step 1: Validate Team ID
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // Step 2: Find team
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not fount",
      });
    }

    // step 3: Only creator can delete the team
    if (team.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can delete this team",
      });
    }

    // Step 4: Delete all related join requests
    await JoinRequest.deleteMany({ team: teamId });

    // Step 5: Delete the team
    await Team.findByIdAndDelete(teamId);

    return res.status(200).json({
      success: true,
      message: "Team deleted Successfully",
    });
  } catch (error) {
    console.error("Delete Team Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete team",
    });
  }
};

const leaveTeam = async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.userId.toString();

  // Step 1: Validate Team ID
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid team ID",
    });
  }

  let session;

  // Helper for business errors
  const fail = (statusCode, message) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
  };

  try {
    // Step 2: Start MongoDB session
    session = await mongoose.startSession();

    let updatedTeamStatus;

    // Step 3: Execute both updates atomically
    await session.withTransaction(async () => {
      // Step 4: Find team inside transaction
      const team = await Team.findById(teamId).session(session);

      if (!team) {
        fail(404, "Team not found");
      }

      // Step 5: Prevent creator from leaving
      if (team.createdBy.toString() === userId) {
        fail(403, "Team creator cannot leave the team");
      }

      // Step 6: Verify student membership
      const isMember = team.members.some(
        (member) => member.user.toString() === userId,
      );

      if (!isMember) {
        fail(400, "You are not a member of this team");
      }

      // Step 7: Update JoinRequest and history
      const leaveTime = new Date();

      const updatedRequest = await JoinRequest.findOneAndUpdate(
        {
          team: teamId,
          user: userId,
          status: "accepted",
        },
        {
          $set: {
            status: "left",
          },
          $push: {
            statusHistory: {
              fromStatus: "accepted",
              toStatus: "left",
              changedBy: userId,
              changedAt: leaveTime,
            },
          },
        },
        {
          session,
          new: true,
          runValidators: true,
        },
      );

      // Step 8: Abort if accepted request is missing
      if (!updatedRequest) {
        fail(
          409,
          "Accepted join request not found. Membership state is inconsistent",
        );
      }

      // Step 9: Remove student from team
      team.members = team.members.filter(
        (member) => member.user.toString() !== userId,
      );

      // Step 10: Reopen full team if space exists
      if (team.status === "full" && team.members.length < team.maxMembers) {
        team.status = "recruiting";
      }

      // Step 11: Save team inside same transaction
      await team.save({ session });

      updatedTeamStatus = team.status;
    });

    // Step 12: Respond after successful commit
    return res.status(200).json({
      success: true,
      message: "You have left the team successfully",
      teamId,
      teamStatus: updatedTeamStatus,
    });
  } catch (error) {
    // Handle expected business errors
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Leave Team Transaction Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to leave team",
    });
  } finally {
    // Step 13: Always release session
    if (session) {
      await session.endSession();
    }
  }
};

const removeTeamMember = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;
    const userId = req.user.userId;

    // step 1: validate ID's
    if (
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(memberId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID or member ID",
      });
    }

    // step 2: Find team
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // step 3: Only creator can remove member
    if (team.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can remove members",
      });
    }

    // step 4: prevent removing the creator
    if (team.createdBy.toString() === memberId) {
      return res.status(400).json({
        success: false,
        message: "Team creator cannot be removed",
      });
    }

    // step 5: check membership
    const isMember = team.members.some(
      (member) => member.user.toString() === memberId,
    );

    if (!isMember) {
      return res.status(404).json({
        success: false,
        message: "User is not a member of this team",
      });
    }

    // step 6: remove member
    team.members = team.members.filter(
      (member) => member.user.toString() !== memberId,
    );

    if (team.status === "full" && team.members.length < team.maxMembers) {
      team.status = "recruiting";
    }

    // step 7: save updated team
    await team.save();

    const removalTime = new Date();

    await JoinRequest.findOneAndUpdate(
      {
        team: teamId,
        user: memberId,
        status: "accepted", // only accepted req should modify
      },
      {
        $set: {
          status: "removed",
        },

        // Record removal in lifecycle history
        $push: {
          statusHistory: {
            fromStatus: "accepted",
            toStatus: "removed",
            changedBy: req.user.userId,
            changedAt: removalTime,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error("Remove Team Member Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove team member",
    });
  }
};

const updateRecruitmentStatus = async (req, res) => {
  try {
    const { teamId } = req.params;

    // step 1: validate req body
    const result = updateRecruitmentStatusSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: "Validation failed",
        errors: result.error.issues.map((issue) => issue.message),
      });
    }

    // step 2: validate team id
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // step 3: find team
    const team = await Team.findById(teamId);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // step 4: check authorization
    if (team.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can update recruitment",
      });
    }

    const { status } = result.data;

    // step 5: prevent reopening a full team (team full hone par use leader bhi reopen nhi kar sakta recruiting ke liye)
    if (status === "recruiting" && team.members.length >= team.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Team is full. Increase capacity before reopening recruitment",
      });
    }

    // step 6: update recruitment status
    team.status = status;

    await team.save();

    return res.status(200).json({
      success: true,
      message:
        status === "closed"
          ? "Team recruitment closed successfully"
          : "Team recruitment opened successfully",
      team: {
        _id: team._id,
        teamName: team.teamName,
        status: team.status,
        currentMembers: team.members.length,
        maxMembers: team.maxMembers,
      },
    });
  } catch (error) {
    console.error("Update Recruitment Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update recruitment status",
    });
  }
};

const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId.toString();

    // step 1: validate team id
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // step 2: find team and populate user details
    const team = await Team.findById(teamId)
      .populate(
        "createdBy",
        "name college branch skills preferredRole github linkedin",
      )
      .populate(
        "members.user",
        "name college branch skills preferredRole github linkedin",
      );

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // step 3: Check whether current user is the creator
    const isCreator = team.createdBy?._id.toString() === userId;

    // step 4: Check whether current user is a member
    const isMember = team.members.some(
      (member) => member.user?._id.toString() === userId,
    );

    // step 5: calculate available slots
    const availableSlots = Math.max(0, team.maxMembers - team.members.length);

    // step 6: return team details
    return res.status(200).json({
      success: true,
      message: "Team details fetched successfully",
      team,
      isCreator,
      isMember,
      availableSlots,
    });
  } catch (error) {
    console.error("Get Team By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team details",
    });
  }
};

const getMyTeamJoinRequest = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;

    // step 1: validate team id
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // step 2: check if team exists
    const team = await Team.findById(teamId).select("_id teamName");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // step 3: find current user's join request
    const joinRequest = await JoinRequest.findOne({
      team: teamId,
      user: userId,
    }).select("_id team user message status createdAt updatedAt reviewdAt");

    // step 4: Handle no existing req
    if (!joinRequest) {
      return res.status(200).json({
        success: true,
        message: "No join request found for this team",
        request: null,
      });
    }

    // step 5: return user's request
    return res.status(200).json({
      success: true,
      message: "Join request fetched successfully",
      request: joinRequest,
    });
  } catch (error) {
    console.error("Get My Team Join Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch join request",
    });
  }
};

const getMyJoinRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    // step 1: Read query parameters
    // if not status given then bydefault we will take fields default
    const { status = "all", page = "1", limit = "10" } = req.query;

    // Step 2: Validate status filter
    const allowedStatuses = [
      "all",
      "pending",
      "accepted",
      "rejected",
      "withdrawn",
      "left",
      "removed",
    ];

    if (typeof status !== "string" || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter",
      });
    }

    // Step 3: Validate pagination parameters
    const isPositiveInteger = (value) =>
      typeof value === "string" &&
      /^[1-9]\d*$/.test(value) &&
      Number.isSafeInteger(Number(value));

    if (!isPositiveInteger(page) || !isPositiveInteger(limit)) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (limitNumber > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot exceed 50",
      });
    }

    // Step 4: Build MongoDB query
    const filter = {
      user: userId,
    };

    if (status != "all") {
      filter.status = status;
    }

    // Step 5: Calculate number of records to skip
    const skip = (pageNumber - 1) * limitNumber;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        success: false,
        message: "Pagination offset is too large",
      });
    }

    // Step 6: Fetch paginated records and count
    const [joinRequests, statusCounts] = await Promise.all([
      // Fetch current page of applications
      JoinRequest.find(filter)
        .select("team message status reviewedAt createdAt updatedAt")
        .populate({
          path: "team",
          select:
            "teamName projectTitle description requiredSkills status maxMembers createdBy",
          populate: {
            path: "createdBy",
            select: "name college",
          },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      // Count ALL applications by status
      // Independent of the selected status filter
      JoinRequest.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      left: 0,
      removed: 0,
    };

    for (const item of statusCounts) {
      stats.total += item.count;

      if (
        Object.prototype.hasOwnProperty.call(stats, item._id) &&
        item._id !== "total"
      ) {
        stats[item._id] = item.count;
      }
    }

    // Total records matching the selected filter
    const totalRequests = status === "all" ? stats.total : stats[status];

    // Step 7: Calculate pagination metadata
    const totalPages = Math.ceil(totalRequests / limitNumber);

    // Step 8: Return response
    return res.status(200).json({
      success: true,
      message: "Join requests fetched successfully",
      appliedFilter: status,
      stats,
      totalRequests,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1 && totalPages > 0,
      },
      requests: joinRequests,
    });
  } catch (error) {
    console.error("Get My Join Requests Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch join requests",
    });
  }
};

const withdrawJoinRequest = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;

    // step 1: Validate Team ID
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // Step 2: check whether team exists
    const teamExists = await Team.exists({
      _id: teamId,
    });

    if (!teamExists) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Step 3: Withdraw only the logged-in student's pending request
    const withdrawalTime = new Date();

    const withdrawnRequest = await JoinRequest.findOneAndUpdate(
      {
        team: teamId,
        user: userId,
        status: "pending",
      },
      {
        $set: {
          status: "withdrawn",
        },

        // Record withdrawal in lifecycle history
        $push: {
          statusHistory: {
            fromStatus: "pending",
            toStatus: "withdrawn",
            changedBy: userId,
            changedAt: withdrawalTime,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    // step 4: Handle unsuccessful withdrawal
    if (!withdrawnRequest) {
      const existingRequest = await joinRequest
        .findOne({
          team: teamId,
          user: userId,
        })
        .select("status");

      if (existingRequest) {
        return res.status(409).json({
          success: false,
          message: "Only pending join requests can be withdrawn",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    // step 5: return success
    return res.status(200).json({
      success: true,
      message: "Join request withdrawn successfully",
      request: withdrawnRequest,
    });
  } catch (error) {
    console.error("Withdraw Join Request Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to withdraw join request",
    });
  }
};

const getMyJoinRequestStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // step 1: Get req counts using aggregation
    const results = await JoinRequest.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // step 2: Initilize default counts
    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      left: 0,
      removed: 0,
    };

    // step 3: convert aggregatioin results
    for (const item of results) {
      if (
        Object.prototype.hasOwnProperty.call(stats, item._id) &&
        item._id !== "total"
      ) {
        stats[item._id] = item.count;
      }

      stats.total += item.count;
    }

    // step 4: return statistics
    return res.status(200).json({
      success: true,
      message: "Join request statistics fetched successfully",
      stats,
    });
  } catch (error) {
    console.error("Get My Join Request Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch join request statistics",
    });
  }
};

const getTeamJoinRequestStats = async (req, res) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.userId;

    // Step 1: Validate Team ID
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(teamId).select("createdBy teamName");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Step 3: Verify team creator
    if (team.createdBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the team creator can view statistics",
      });
    }

    // step 4: Aggregate requests by status
    const results = await JoinRequest.aggregate([
      {
        $match: {
          team: team._id,
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // step 5: Initialize statistics
    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      left: 0,
      removed: 0,
    };

    // Step 6: Process aggregation results
    for (const item of results) {
      stats.total += item.count;

      if (
        Object.prototype.hasOwnProperty.call(stats, item._id) &&
        item._id !== "total"
      ) {
        stats[item._id] = item.count;
      }
    }

    // Step 7: Return statistics
    return res.status(200).json({
      success: true,
      message: "Team join request statistics fetched successfully",
      stats,
    });
  } catch (error) {
    console.error("Get Team Join Request Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team join request statistics",
    });
  }
};

const getJoinRequestHistory = async (req, res) => {
  try {
    const { teamId, requestId } = req.params;
    const userId = req.userId.toString();

    // Step 1: Validate MongoDB IDs
    if (
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(requestId)
    ) {
      return res.stats(400).json({
        success: false,
        message: "Invalid team ID or request ID",
      });
    }

    // Step 2: Check whether team exists
    const team = await Team.findById(teamId)
      .select("createdBy teamName")
      .lean();

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // Step 3: Find request belonging to this team
    const joinRequest = await JoinRequest.findOne({
      _id: requestId,
      team: teamId,
    })
      .select("team user status statusHistory createdAt updatedAt")
      .lean();

    if (!joinRequest) {
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    // Step 4: Check authorization
    const isApplicant = joinRequest.user.toString() === userId;

    const isTeamCreator = team.createdBy.toString() === userId;

    if (!isApplicant && !isTeamCreator) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this request history",
      });
    }

    // Step 5: Return recorded history
    const history = joinRequest.statusHistory || [];

    return res.status(200).json({
      success: true,
      message: "Join request history fetched successfully",
      request: {
        _id: joinRequest._id,
        team: joinRequest.team,
        user: joinRequest.user,
        currentStatus: joinRequest.status,
        totalEvents: history.length,
        statusHistory: history,
      },
    });
  } catch (error) {
    console.error("Get Join Request History Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch join request history",
    });
  }
};

module.exports = {
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
  getMyJoinRequestStats,
  getTeamJoinRequestStats,
  getJoinRequestHistory,
};
