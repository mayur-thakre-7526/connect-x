const User = require("../models/User.js");
const {
  discoverySchema,
} = require("../utils/validators/discovery.validator.js");

const discoverStudents = async (req, res) => {
  try {
    // Validate query parameters
    const validationResult = discoverySchema.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid search parameters",
        errors: validationResult.error.issues,
      });
    }

    const { skill, interest, college, branch, graduationYear, page, limit } =
      validationResult.data;

    // Build mongo query
    const query = {
      _id: { $ne: req.user.userId },
    };

    if (skill) {
      query.skills = {
        $regex: skill,
        $options: "i",
      };
    }

    if (interest) {
      query.interests = {
        $regex: interest,
        $options: "i",
      };
    }

    if (college) {
      query.college = {
        $regex: college,
        $options: "i",
      };
    }

    if (branch) {
      query.branch = {
        $regex: branch,
        $options: "i",
      };
    }

    if (graduationYear) {
      query.graduationYear = graduationYear;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Fetch students and total count
    const [students, totalStudents] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalStudents / limit);

    return res.status(200).json({
      success: true,
      message: "Students fetched successfully",

      pagination: {
        currentPage: page,
        limit,
        totalStudents,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,

        students,
      },
    });
  } catch (error) {
    console.error("Discover students error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { discoverStudents };
