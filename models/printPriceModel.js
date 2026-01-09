const mongoose = require("mongoose");

const printPriceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // ✅ discount applies when qty >= discountMinQty
    discountMinQty: {
      type: Number,
      default: 0,
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
        required: true, // ✅ required now
        min: 0,
      },
      twoSide: {
        type: Number,
        required: true, // ✅ required now
        min: 0,
      },
    },

    // optional: you can keep defaults as 0
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
  { timestamps: true }
);

// ✅ normalize title before saving (helps avoid "A4 " vs "a4")
printPriceSchema.pre("save", function (next) {
  if (this.title) this.title = this.title.trim();
  next();
});

// ✅ also normalize title for findOneAndUpdate (used by findByIdAndUpdate)
printPriceSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  if (update.title) update.title = String(update.title).trim();
  if (update.$set?.title) update.$set.title = String(update.$set.title).trim();
  this.setUpdate(update);
  next();
});

module.exports = mongoose.model("Pprice", printPriceSchema);
