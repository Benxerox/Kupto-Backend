

// config/jwtToken.js
const jwt = require("jsonwebtoken");
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1m" });
module.exports = { generateToken };