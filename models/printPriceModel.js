const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
const printPriceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // ✅ minimum quantity required for discount prices to apply
    // Example: if discountMinQty = 50, then discount applies when qty >= 50
    discountMinQty: {
      type: Number,
      default: 0, // 0 means "no minimum" / discount rule disabled unless you want otherwise
      min: 0,
    },

    preparePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    printPrice: {
      oneSide: {
        type: Number,
        default: 0,
        min: 0,
      },
      twoSide: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    printPriceDiscount: {
      oneSide: {
        type: Number,
        default: 0,
        min: 0,
      },
      twoSide: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Export the model
module.exports = mongoose.model("Pprice", printPriceSchema);
