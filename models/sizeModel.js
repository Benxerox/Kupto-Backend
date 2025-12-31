// models/sizeModel.js
const mongoose = require("mongoose");

/**
 * Helpers to make validators work on BOTH:
 * - Document validation (this.price, this.discountPrice)
 * - Query update validation (this.getUpdate().price, $set.price, etc.)
 */
const getUpdate = (ctx) => {
  if (!ctx || typeof ctx.getUpdate !== "function") return null;
  return ctx.getUpdate() || null;
};

const getVal = (ctx, field) => {
  // 1) Document context
  if (ctx && Object.prototype.hasOwnProperty.call(ctx, field)) return ctx[field];

  // 2) Query/update context
  const u = getUpdate(ctx);
  if (!u) return undefined;

  // direct
  if (Object.prototype.hasOwnProperty.call(u, field)) return u[field];

  // $set / $setOnInsert
  if (u.$set && Object.prototype.hasOwnProperty.call(u.$set, field)) return u.$set[field];
  if (u.$setOnInsert && Object.prototype.hasOwnProperty.call(u.$setOnInsert, field))
    return u.$setOnInsert[field];

  return undefined;
};

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
       ✅ discountPrice allowed even when price is NULL.
       - If price exists: discountPrice must be < price.
       - If price is NULL: discountPrice is treated as absolute fixed price.
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

          const price = getVal(this, "price"); // supports update context too

          // if price is set, enforce discountPrice < price
          if (price !== null && price !== undefined) {
            return Number(v) < Number(price);
          }

          // if price is NOT set, allow discountPrice (absolute)
          return true;
        },
        message: "discountPrice must be less than price (when price is set).",
      },
    },

    discountMinQty: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const discountPrice = getVal(this, "discountPrice"); // supports update context too

          // if you set a min qty, you must set a discount price too
          return discountPrice !== null && discountPrice !== undefined;
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
sizeSchema.methods.getCurrentPrice = function (basePrice = 0) {
  if (this.price !== null && this.price !== undefined) return Number(this.price);
  return Number(basePrice || 0) + Number(this.priceAdjustment || 0);
};

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
