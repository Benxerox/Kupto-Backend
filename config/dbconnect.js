const mongoose = require("mongoose");

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Database Connected Successfully');
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
};

module.exports = dbConnect;

