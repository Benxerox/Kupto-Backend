// models/sizeModel.js
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
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
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
    width: { type: Number, default: null, min: 0 },
    height: { type: Number, default: null, min: 0 },

    unit: {
      type: String,
      enum: ["mm", "cm", "inch"],
      default: "mm",
    },

    /* =====================
       PRICING (UPDATED)
       ✅ Fix: allow discountPrice/discountMinQty even when price is NULL.
       - If price exists: discountPrice must be < price.
       - If price is NULL: discountPrice is treated as an absolute fixed price.
       - discountMinQty requires discountPrice.
    ===================== */
    price: {
      type: Number,
      default: null,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          // if price is set, enforce discountPrice < price
          if (this.price !== null && this.price !== undefined) {
            return Number(v) < Number(this.price);
          }

          // if price is NOT set, allow discountPrice (treat as absolute)
          return true;
        },
        message: "discountPrice must be less than price (when price is set).",
      },
    },

    // ✅ Bulk discount threshold (optional)
    // Example: 10 => discountPrice applies when qty >= 10
    discountMinQty: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          // if you set a min qty, you must set a discount price too
          return this.discountPrice !== null && this.discountPrice !== undefined;
        },
        message: "discountMinQty requires discountPrice to be set.",
      },
    },

    // used only when `price` is not set
    priceAdjustment: {
      type: Number,
      default: 0,
    },

    /* =====================
       PRINTING NOTES
    ===================== */
    printNotes: {
      type: String,
      default: "",
      trim: true,
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
      default: null,
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
sizeSchema.index({ isActive: 1, sortOrder: 1 });

/* =====================
   VIRTUALS
===================== */
sizeSchema.virtual("label").get(function () {
  if (this.width && this.height) return `${this.width} x ${this.height} ${this.unit}`;
  return this.name;
});

sizeSchema.virtual("hasFixedPrice").get(function () {
  return this.price !== null && this.price !== undefined;
});

/* =====================
   METHODS
===================== */
/**
 * Returns CURRENT price for this size (NO quantity logic here):
 * Priority:
 * 1) if price exists => price
 * 2) else => basePrice + priceAdjustment
 */
sizeSchema.methods.getCurrentPrice = function (basePrice = 0) {
  if (this.price !== null && this.price !== undefined) return Number(this.price);
  return Number(basePrice || 0) + Number(this.priceAdjustment || 0);
};

/**
 * Returns price based on quantity:
 * - if discountPrice + discountMinQty exist and qty >= discountMinQty => discountPrice
 * - else => current price (price or base+adjustment)
 *
 * NOTE: discountPrice is treated as absolute final price (not computed).
 */
sizeSchema.methods.getPriceByQty = function (qty = 1, basePrice = 0) {
  const q = Math.max(1, Number(qty || 1));

  const hasDiscount =
    this.discountPrice !== null &&
    this.discountPrice !== undefined &&
    !Number.isNaN(Number(this.discountPrice));

  const hasMin =
    this.discountMinQty !== null &&
    this.discountMinQty !== undefined &&
    !Number.isNaN(Number(this.discountMinQty));

  if (hasDiscount && hasMin && q >= Number(this.discountMinQty)) {
    return Number(this.discountPrice);
  }

  return this.getCurrentPrice(basePrice);
};

module.exports = mongoose.model("Size", sizeSchema);
