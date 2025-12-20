const jwt = require('jsonwebtoken');

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '120d' }); // Refresh token expires in 30 days
};

module.exports = {generateRefreshToken};


