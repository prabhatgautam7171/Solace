
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateAccessToken = (userId) => {
  return jwt.sign(
    { sub: userId.toString() },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    }
  );
};

export const generateRefreshToken = (userId) => {
  const secret = crypto.randomBytes(48).toString("hex");

  return `${userId}.${secret}`;
};

export const hashToken = (token) => {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
};

export const verifyTokenHash = (token, storedHash) => {
  const incomingHash = Buffer.from(hashToken(token), "hex");
  const existingHash = Buffer.from(storedHash, "hex");

  return (
    incomingHash.length === existingHash.length &&
    crypto.timingSafeEqual(incomingHash, existingHash)
  );
};
