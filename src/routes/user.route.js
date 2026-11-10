
import { Router } from "express";

import {
  getProfile,
  updateProfile,
  changePassword,
} from "../controllers/user.controller.js";

import authenticate from "../middleware/auth.middleware.js";
import validate from "../middleware/validate.middleware.js";

import {
  updateProfileSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";

const router = Router();

router.use(authenticate);

router.get("/me", getProfile);

router.patch(
  "/me",
  validate(updateProfileSchema),
  updateProfile
);

router.patch(
  "/change-password",
  validate(changePasswordSchema),
  changePassword
);

export default router;
