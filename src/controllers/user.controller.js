
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";

// ============================================
// GET USER PROFILE
// ============================================
export const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    [
      "name",
      "email",
      "avatar",
      "bio",
      "wellnessGoals",
      "onboardingCompleted",
      "preferences",
      "privacy",
      "isEmailVerified",
      "isActive",
      "lastActiveAt",
      "createdAt",
      "updatedAt",
    ].join(" ")
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

// ============================================
// UPDATE USER PROFILE
// ============================================
export const updateProfile = asyncHandler(async (req, res) => {
  const {
    name,
    avatar,
    bio,
    wellnessGoals,
    onboardingCompleted,
    preferences,
    privacy,
  } = req.validatedBody;

  // Always fetch the latest database document.
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Personal information
  if (name !== undefined) {
    user.name = name;
  }

  if (avatar !== undefined) {
    user.avatar = avatar;
  }

  if (bio !== undefined) {
    user.bio = bio;
  }

  // Wellness identity
  if (wellnessGoals !== undefined) {
    user.wellnessGoals = wellnessGoals;
  }

  if (onboardingCompleted !== undefined) {
    user.onboardingCompleted = onboardingCompleted;
  }

  // App preferences
  if (preferences) {
    const currentPreferences =
      user.preferences?.toObject?.() ??
      user.preferences?.toJSON?.() ??
      user.preferences ??
      {};

    user.preferences = {
      ...currentPreferences,
      ...preferences,
    };
  }

  // Privacy settings
  if (privacy) {
    const currentPrivacy =
      user.privacy?.toObject?.() ??
      user.privacy?.toJSON?.() ??
      user.privacy ??
      {};

    user.privacy = {
      ...currentPrivacy,
      ...privacy,
    };
  }

  await user.save();

  // Return only safe profile fields.
  const updatedUser = await User.findById(user._id).select(
    [
      "name",
      "email",
      "avatar",
      "bio",
      "wellnessGoals",
      "onboardingCompleted",
      "preferences",
      "privacy",
      "isEmailVerified",
      "isActive",
      "lastActiveAt",
      "createdAt",
      "updatedAt",
    ].join(" ")
  );

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: { user: updatedUser },
  });
});

// ============================================
// CHANGE PASSWORD
// ============================================
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validatedBody;

  const user = await User.findById(req.user._id).select(
    "+password +refreshTokenHash +refreshTokenExpiresAt"
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  const isPasswordValid = await user.comparePassword(
    currentPassword
  );

  if (!isPasswordValid) {
    return res.status(400).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from your current password",
    });
  }

  // Update password. The User model pre-save hook hashes it.
  user.password = newPassword;

  // Invalidate the refresh-token session.
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;

  await user.save();

  res.status(200).json({
    success: true,
    message: "Password changed successfully. Please log in again.",
  });
});
