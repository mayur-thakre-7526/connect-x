//Humein ensure karna hai ki user profile update karte waqt valid data hi backend tak aaye.

const { z } = require("zod");

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(50).optional(),

    college: z.string().trim().max(100).optional(),

    branch: z.string().trim().max(100).optional(),

    graduationYear: z.number().int().min(2020).max(2040).optional(),

    skills: z.array(z.string().trim().min(1)).optional(),

    interests: z.array(z.string().trim().min(1)).optional(),

    preferredRole: z.string().trim().max(100).optional(),

    bio: z.string().trim().max(300).optional(),

    github: z.string().trim().url().or(z.literal("")).optional(),

    linkedin: z.string().trim().url().or(z.literal("")).optional(),
  })
  .strict();

module.exports = { updateProfileSchema };
