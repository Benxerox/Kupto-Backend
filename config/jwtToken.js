
const jwt = require("jsonwebtoken");

/**
 * Access Token (SHORT-LIVED)
 * Used for authorizing normal API requests.
 * Keep it short so if it leaks, it's not useful for long.
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "15m" });
};

module.exports = { generateToken };