// config/refreshToken.js
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const generateRefreshToken = (id) =>
  jwt.sign(
    { id, jti: crypto.randomBytes(16).toString("hex") },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "30d" }
  );

module.exports = { generateRefreshToken };