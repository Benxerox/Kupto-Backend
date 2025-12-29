/*const mongoose = require('mongoose'); 

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
    width: { type: Number, default: null },
    height: { type: Number, default: null },

    unit: {
      type: String,
      enum: ["mm", "cm", "inch"],
      default: "mm",
    },

    /* =====================
       PRICING (optional)
       Some sizes can have fixed price + discount price
    ===================== */
    price: {
      type: Number,
      default: null, // when set => overrides basePrice + adjustment
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: function (v) {
          // allow null
          if (v === null || v === undefined) return true;
          // must have a price to compare against
          if (this.price === null || this.price === undefined) return false;
          return v < this.price;
        },
        message: "discountPrice must be less than price (and price must be set).",
      },
    },

    /* =====================
       PRICE ADJUSTMENT (fallback)
       Used when `price` is not set
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
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },

    /* =====================
       METADATA
    ===================== */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
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

// ✅ quick flag for UI: shows if this size has fixed pricing
sizeSchema.virtual("hasFixedPrice").get(function () {
  return this.price !== null && this.price !== undefined;
});

/* =====================
   METHODS
===================== */
/**
 * Returns effective price for this size:
 * 1) if discountPrice exists => discountPrice
 * 2) else if price exists => price
 * 3) else => basePrice + priceAdjustment
 */
sizeSchema.methods.getFinalPrice = function (basePrice = 0) {
  if (this.discountPrice !== null && this.discountPrice !== undefined) {
    return this.discountPrice;
  }
  if (this.price !== null && this.price !== undefined) {
    return this.price;
  }
  return Number(basePrice || 0) + Number(this.priceAdjustment || 0);
};

module.exports = mongoose.model("Size", sizeSchema);
