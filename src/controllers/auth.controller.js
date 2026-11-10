
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";

import {
  issueTokens,
  refreshTokens,
} from "../services/auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.validatedBody;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists",
    });
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  const tokens = await issueTokens(user);

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    data: {
      user,
      tokens,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validatedBody;

  const user = await User.findOne({ email })
    .select("+password +refreshTokenHash");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      message: "Your account is inactive",
    });
  }

  const tokens = await issueTokens(user);

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user,
      tokens,
    },
  });
});

export const refreshAccessToken = asyncHandler(
  async (req, res) => {
    const { refreshToken } = req.validatedBody;

    const tokens = await refreshTokens(refreshToken);

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token. Please log in again.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      data: { tokens },
    });
  }
);

export const logout = asyncHandler(async (req, res) => {
  await User.updateOne(
    { _id: req.user._id },
    { $set: { refreshTokenHash: null } }
  );

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});
