const jwt = require('jsonwebtoken');

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '120d' }); // Refresh token expires in 30 days
};

<<<<<<< HEAD
module.exports = {generateRefreshToken};


=======
module.exports = {generateRefreshToken};
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
