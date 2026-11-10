
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),

  email: z.string().trim().email().max(254),

  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),

  password: z.string().min(1).max(72),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),

  newPassword: z.string().min(8).max(72),
});


export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),

  avatar: z.string().url().nullable().optional(),

  bio: z.string().trim().max(250).optional(),

  wellnessGoals: z.array(
    z.enum([
      "manage_stress",
      "improve_sleep",
      "build_confidence",
      "emotional_awareness",
      "practice_mindfulness",
      "build_habits",
    ])
  ).max(6).optional(),

  onboardingCompleted: z.boolean().optional(),

  preferences: z.object({
    personalizationEnabled: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    language: z.string().trim().min(2).max(10).optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    weeklySummaryEnabled: z.boolean().optional(),
  }).strict().optional(),

  privacy: z.object({
    analyticsEnabled: z.boolean().optional(),
  }).strict().optional(),
}).strict();
