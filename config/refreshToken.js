

// config/refreshToken.js
const jwt = require("jsonwebtoken");
const generateRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
module.exports = { generateRefreshToken };