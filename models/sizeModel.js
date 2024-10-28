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
    default: 0,
  },
  discountPrice: {
    type: Number,
    default: 0,
  }, 
  printingPrice: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Export the model
module.exports = mongoose.model('Size', sizeSchema);