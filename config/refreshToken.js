
const jwt = require("jsonwebtoken");

/**
 * Refresh Token (LONG-LIVED)
 * Used to get a new access token when it expires.
 * This is what makes the user "stay logged in".
 */
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

module.exports = { generateRefreshToken };