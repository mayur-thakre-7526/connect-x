const { z } = require("zod");

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

module.exports = { createTeamSchema, discoverTeamsSchema };
