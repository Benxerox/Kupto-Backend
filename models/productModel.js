// models/productModel.js
const mongoose = require("mongoose");

/**
 * Helpers to make validators work on BOTH:
 * - Document validation (this.price, this.discountedPrice)
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

/* =========================
   Bulk discount sub-schema
   (matches your admin UI)
========================= */
const bulkDiscountSchema = new mongoose.Schema(
  {
    // qty at which bulk discount starts (example: 1000)
    minQty: { type: Number, default: null, min: 1 },

    // discounted unit price when qty >= minQty
    price: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },

    description: { type: String, required: true },

    /* =========================
       PRICING
       - price = base (normal) unit price
       - discountedPrice = SALE unit price (lower than price)
       - discountMinQty = qty at which discountedPrice activates
       - bulkDiscount = another qty based pricing (like UI "Bulk Min Qty / Bulk Unit Price")
    ========================= */

    // ✅ base unit price (normal price)
    price: { type: Number, required: true, min: 0 },

    // ✅ SALE unit price (like sizeModel.discountPrice)
    discountedPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const price = getVal(this, "price");

          // if price exists, enforce discountedPrice < price
          if (price !== null && price !== undefined) {
            return Number(v) < Number(price);
          }

          // product always has price required, but keep compatible anyway
          return true;
        },
        message: "discountedPrice must be less than price.",
      },
    },

    // ✅ qty threshold for discountedPrice (like sizeModel.discountMinQty)
    discountMinQty: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const disc = getVal(this, "discountedPrice");

          // if you set a min qty, you must set discountedPrice too
          return disc !== null && disc !== undefined;
        },
        message: "discountMinQty requires discountedPrice to be set.",
      },
    },

    /**
     * ✅ bulkDiscount (same idea as above, but as an object)
     * If minQty + price are both set and orderQty >= minQty -> use bulkDiscount.price
     */
    bulkDiscount: {
      type: bulkDiscountSchema,
      default: () => ({ minQty: null, price: null }),
      validate: {
        validator: function (v) {
          if (!v) return true;

          const minQty = v.minQty;
          const discPrice = v.price;

          const hasMin = minQty !== null && minQty !== undefined;
          const hasPrice = discPrice !== null && discPrice !== undefined;

          // allow both null (no bulk discount)
          if (!hasMin && !hasPrice) return true;

          // if one is set, require the other
          if (hasMin !== hasPrice) return false;

          // enforce bulk price <= base price
          if (hasMin && hasPrice) {
            const base = getVal(this, "price");
            return Number(discPrice) <= Number(base);
          }

          return true;
        },
        message:
          "bulkDiscount requires BOTH minQty and price, and bulkDiscount.price must be <= price.",
      },
    },

    /* =========================
       CATALOG
    ========================= */
    category: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    // store brand title (string)
    brand: { type: String, required: true, trim: true },

    tags: [{ type: String, trim: true }],

    quantity: { type: Number, required: true, min: 0 },

    /* =========================
       ORDER CONSTRAINTS
    ========================= */
    minOrder: { type: Number, default: null, min: 1 },

    maxOrder: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const minOrder = getVal(this, "minOrder");

          if (minOrder === null || minOrder === undefined) return true;
          return Number(v) >= Number(minOrder);
        },
        message: "maxOrder must be greater than or equal to minOrder.",
      },
    },

    sold: { type: Number, default: 0 },

    /* =========================
       PRINTING
    ========================= */
    isPrintable: { type: Boolean, default: false },

    printingPrice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pprice",
      default: null,
    },

    printSpec: {
      allowedExtensions: {
        type: [String],
        default: ["pdf", "png", "jpg", "jpeg", "cdr", "ai"],
      },
      maxFileSizeMB: { type: Number, default: 50 },
      instructions: { type: String, default: "", trim: true },
    },

    /* =========================
       IMAGES / VARIANTS
    ========================= */
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],

    color: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color", index: true }],
    size: [{ type: mongoose.Schema.Types.ObjectId, ref: "Size" }],

    variantImages: [
      {
        color: { type: mongoose.Schema.Types.ObjectId, ref: "Color", required: true },
        images: {
          type: [
            {
              public_id: { type: String, required: true },
              url: { type: String, required: true },
            },
          ],
          default: [],
        },
      },
    ],

    /* =========================
       RATINGS
    ========================= */
    ratings: [
      {
        star: { type: Number, min: 1, max: 5, required: true },
        comment: { type: String, trim: true, default: "" },
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],

    totalrating: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

/* =========================
   Indexes
========================= */
productSchema.index({ title: "text", description: "text" });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });

/* =========================
   Guards / cleanup
========================= */
productSchema.pre("validate", function (next) {
  // keep variantImages consistent with selected colors
  if (Array.isArray(this.variantImages) && Array.isArray(this.color)) {
    const allowed = new Set(this.color.map(String));
    this.variantImages = this.variantImages
      .filter((v) => v?.color && allowed.has(String(v.color)))
      .map((v) => ({
        ...v,
        images: Array.isArray(v.images) ? v.images : [],
      }));
  }

  // if not printable -> force printingPrice to null
  if (!this.isPrintable) {
    this.printingPrice = null;
  }

  next();
});

/* =========================
   OPTIONAL: instance method
   compute unit price by qty
========================= */
productSchema.methods.getUnitPriceByQty = function (qty = 1) {
  const q = Math.max(1, Number(qty || 1));
  const base = Number(this.price || 0);

  // 1) bulkDiscount overrides (if set and qty hits)
  const bdMin = this.bulkDiscount?.minQty;
  const bdPrice = this.bulkDiscount?.price;
  if (bdMin != null && bdPrice != null && q >= Number(bdMin)) {
    return Number(bdPrice);
  }

  // 2) discountedPrice with discountMinQty
  if (this.discountedPrice != null) {
    if (this.discountMinQty != null && q >= Number(this.discountMinQty)) {
      return Number(this.discountedPrice);
    }
  }

  // 3) normal price
  return base;
};

module.exports = mongoose.model("Product", productSchema);
