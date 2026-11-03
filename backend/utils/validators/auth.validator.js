const { z } = require("zod");

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must contain at least 2 characters")
    .max(50, "Name cannot exceed 50 characters"),

  email: z.string().trim().email("Please provide a valid email address"),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(72, "Password is too long"),
});

const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address"),

  password: z.string().min(1, "Password is required"),
});

module.exports = {
  registerSchema,
  loginSchema,
};
