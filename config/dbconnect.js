/*const mongoose = require("mongoose");

const dbConnect = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Database Connected Successfully');
  } catch (error) {
    console.error('Database connection error:', error.message);
  }
};

module.exports = dbConnect;*/

const mongoose = require('mongoose');

const dbConnect = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL); // Removed deprecated options
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1); // Exit process if connection fails
    }
};

module.exports = dbConnect;