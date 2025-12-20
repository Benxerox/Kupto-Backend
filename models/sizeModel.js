<<<<<<< HEAD
/*const mongoose = require('mongoose'); 
=======
const mongoose = require('mongoose'); // Erase if already required
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950

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
<<<<<<< HEAD
module.exports = mongoose.model('Size', sizeSchema);*/

const mongoose = require("mongoose");

const sizeSchema = new mongoose.Schema(
  {
    /* =====================
       BASIC SIZE INFO
    ===================== */
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, 
      // examples: "Small", "A4", "XL", "210 x 297 mm"
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      // examples: "a4", "xl", "210x297-mm"
    },

    /* =====================
       SIZE TYPE
       helps filtering & UI
    ===================== */
    type: {
      type: String,
      enum: ["apparel", "paper", "banner", "custom"],
      default: "custom",
      index: true,
    },

    /* =====================
       DIMENSIONS (optional)
    ===================== */
    width: {
      type: Number,
      default: null,
      // in mm or cm depending on your standard
    },

    height: {
      type: Number,
      default: null,
    },

    unit: {
      type: String,
      enum: ["mm", "cm", "inch"],
      default: "mm",
    },

    /* =====================
       PRICE ADJUSTMENT
    ===================== */
    priceAdjustment: {
      type: Number,
      default: 0,
      // example: +5000 for A3, +10000 for XXL
    },

    /* =====================
       PRINTING NOTES
    ===================== */
    printNotes: {
      type: String,
      default: "",
      // e.g. "Landscape only", "Requires lamination"
    },

    /* =====================
       VISIBILITY
    ===================== */
    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    /* =====================
       METADATA
    ===================== */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/* =====================
   INDEXES
===================== */
sizeSchema.index({ name: 1 });
sizeSchema.index({ slug: 1 });
sizeSchema.index({ type: 1 });

/* =====================
   VIRTUALS
===================== */
sizeSchema.virtual("label").get(function () {
  if (this.width && this.height) {
    return `${this.width} x ${this.height} ${this.unit}`;
  }
  return this.name;
});

/* =====================
   METHODS
===================== */
sizeSchema.methods.getPrice = function (basePrice) {
  return basePrice + (this.priceAdjustment || 0);
};

module.exports = mongoose.model("Size", sizeSchema);
=======
module.exports = mongoose.model('Size', sizeSchema);
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
