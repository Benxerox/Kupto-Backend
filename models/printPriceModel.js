const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
const printPriceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
    index: true,
  }, 
 
    preparePrice: {
      type: Number,
      default: 0,
    },
  
  printPrice: {
    oneSide: {
      type: Number,
      default: 0,
    },
    twoSide: {
      type: Number,
      default: 0,
    }
  },
  discountPrintPrice: {
    oneSide: {
      type: Number,
      default: 0,
    },
    twoSide: {
      type: Number,
      default: 0,
    }
  },
}, {
  timestamps: true,
});

// Export the model
module.exports = mongoose.model('Pprice', printPriceSchema);