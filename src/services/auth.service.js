
import User from "../models/User.js";

import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyTokenHash,
} from "../utils/token.utils.js";

const issueTokens = async (user) => {
  const accessToken = generateAccessToken(user._id);

  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);

  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

  user.refreshTokenHash = hashToken(refreshToken);

  user.refreshTokenExpiresAt = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  );

  await user.save({ validateBeforeSave: false });

  await user.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 900,
  };
};

const refreshTokens = async (token) => {
  const [userId] = token.split(".");

  if (!userId || !/^[a-f\d]{24}$/i.test(userId)) {
    return null;
  }

  const user = await User.findById(userId)
    .select("+refreshTokenHash");

  if (
    !user ||
    !user.isActive ||
    !user.refreshTokenHash ||
    !verifyTokenHash(token, user.refreshTokenHash)
  ) {
    return null;
  }

  // Rotate refresh token atomically.
  const oldHash = user.refreshTokenHash;

  const newRefreshToken = generateRefreshToken(user._id);

  const newHash = hashToken(newRefreshToken);

  const result = await User.updateOne(
    {
      _id: user._id,
      refreshTokenHash: oldHash,
    },
    {
      $set: {
        refreshTokenHash: newHash,
      },
    }
  );

  if (result.modifiedCount !== 1) {
    return null;
  }

  return {
    accessToken: generateAccessToken(user._id),
    refreshToken: newRefreshToken,
    tokenType: "Bearer",
    expiresIn: 900,
  };
};

export { issueTokens, refreshTokens };
