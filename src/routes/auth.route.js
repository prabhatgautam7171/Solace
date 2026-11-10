
import { Router } from "express";

import {
  register,
  login,
  refreshAccessToken,
  logout,
} from "../controllers/auth.controller.js";

import authenticate from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.middleware.js";

import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate(registerSchema), register);

router.post("/login", validate(loginSchema), login);

router.post(
  "/refresh-token",
  validate(refreshTokenSchema),
  refreshAccessToken
);

router.post("/logout", authenticate, logout);

export default router;
