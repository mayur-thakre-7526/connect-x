//strict() — unknown fields ko reject karega.

const { z } = require("zod");

const discoverySchema = z
  .object({
    skill: z.string().trim().optional(),

    interest: z.string().trim().optional(),

    college: z.string().trim().optional(),

    branch: z.string().trim().optional(),

    graduationYear: z.coerce.number().int().min(2020).max(2040).optional(),

    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(10),
  })
  .strict();

module.exports = { discoverySchema };
