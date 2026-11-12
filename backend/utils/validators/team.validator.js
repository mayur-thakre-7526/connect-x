const { z } = require("zod");
const { describe } = require("zod/v4/core");

const createTeamSchema = z
  .object({
    teamName: z.string().trim().min(3).max(50),

    description: z.string().trim().min(10).max(500),

    projectTitle: z.string().trim().max(100).optional(),

    requiredSkills: z.array(z.string().trim().min(1)).max(20).optional(),

    maxMembers: z.coerce.number().int().min(2).max(10).default(5),
  })
  .strict();

const discoverTeamsSchema = z
  .object({
    skill: z.string().trim().optional(),
    status: z.enum(["recruiting", "closed"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

const createJoinRequestSchema = z
  .object({
    message: z.string().trim().max(300).optional().default(""),
  })
  .strict();

const updateTeamSchema = z
  .object({
    teamName: z.string().trim().min(3).max(50).optional(),

    description: z.string().trim().min(10).max(500).optional(),

    projectTitle: z.string().trim().max(100).optional(),

    requiredSkills: z.array(z.string().trim().min(1)).max(20).optional(),

    maxMembers: z.coerce.number().int().min(2).max(10).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update the team",
  });

module.exports = {
  createTeamSchema,
  discoverTeamsSchema,
  createJoinRequestSchema,
  updateTeamSchema,
};
