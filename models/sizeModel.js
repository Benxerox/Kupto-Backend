const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
const sizeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  price: {
    type: Number,
    required: true,
  },
}, {
  timestamps: true,
});

// Export the model
module.exports = mongoose.model('Size', sizeSchema);