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
  if (u.$setOnInsert && Object.prototype.hasOwnProperty.call(u.$setOnInsert, field)) {
    return u.$setOnInsert[field];
  }

  return undefined;
};

const isPresent = (v) => v !== null && v !== undefined;

const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img && img.public_id && img.url)
    .map((img) => ({
      public_id: String(img.public_id).trim(),
      url: String(img.url).trim(),
    }));
};

/* =========================
   Bulk discount sub-schema
========================= */
const bulkDiscountSchema = new mongoose.Schema(
  {
    // qty at which bulk discount starts
    minQty: { type: Number, default: null, min: 1 },

    // discounted unit price when qty >= minQty
    price: { type: Number, default: null, min: 0 },
  },
  { _id: false }
);

/* =========================
   Shared image schema
========================= */
const imageSchema = new mongoose.Schema(
  {
    public_id: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

/* =========================
   Color variant pricing schema
   Each color can have its own price
========================= */
const colorVariantSchema = new mongoose.Schema(
  {
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },

    // optional override price for this color
    // if null => fall back to main product price
    price: {
      type: Number,
      default: null,
      min: 0,
    },

    // optional sale price for this color
    discountedPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    // qty threshold for discountedPrice
    discountMinQty: {
      type: Number,
      default: null,
      min: 1,
    },

    // optional bulk pricing for this color
    bulkDiscount: {
      type: bulkDiscountSchema,
      default: () => ({ minQty: null, price: null }),
    },

    // optional stock quantity per color
    quantity: {
      type: Number,
      default: null,
      min: 0,
    },

    images: {
      type: [imageSchema],
      default: [],
    },
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
       - bulkDiscount = another qty based pricing
    ========================= */
    price: { type: Number, required: true, min: 0 },

    discountedPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const price = getVal(this, "price");

          if (price !== null && price !== undefined) {
            return Number(v) < Number(price);
          }

          return true;
        },
        message: "discountedPrice must be less than price.",
      },
    },

    discountMinQty: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v === null || v === undefined) return true;

          const disc = getVal(this, "discountedPrice");
          return disc !== null && disc !== undefined;
        },
        message: "discountMinQty requires discountedPrice to be set.",
      },
    },

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

          if (!hasMin && !hasPrice) return true;
          if (hasMin !== hasPrice) return false;

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

    // general stock if you are not using per-color stock
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
    images: {
      type: [imageSchema],
      default: [],
    },

    color: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color", index: true }],
    size: [{ type: mongoose.Schema.Types.ObjectId, ref: "Size" }],

    /**
     * colorVariants:
     * Each selected color can have:
     * - its own price
     * - its own discount
     * - its own bulk discount
     * - its own stock
     * - its own images
     */
    colorVariants: {
      type: [colorVariantSchema],
      default: [],
    },

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
productSchema.index({ color: 1 });
productSchema.index({ "colorVariants.color": 1 });

/* =========================
   Guards / cleanup
========================= */
productSchema.pre("validate", function (next) {
  // normalize top-level numeric nullable fields
  this.discountedPrice = toNumberOrNull(this.discountedPrice);
  this.discountMinQty = toNumberOrNull(this.discountMinQty);
  this.minOrder = toNumberOrNull(this.minOrder);
  this.maxOrder = toNumberOrNull(this.maxOrder);

  if (this.bulkDiscount) {
    this.bulkDiscount.minQty = toNumberOrNull(this.bulkDiscount.minQty);
    this.bulkDiscount.price = toNumberOrNull(this.bulkDiscount.price);
  }

  // keep colorVariants consistent with selected colors
  if (Array.isArray(this.colorVariants) && Array.isArray(this.color)) {
    const allowed = new Set(this.color.map(String));

    this.colorVariants = this.colorVariants
      .filter((v) => v?.color && allowed.has(String(v.color)))
      .map((v) => ({
        color: v.color,
        price: toNumberOrNull(v.price),
        discountedPrice: toNumberOrNull(v.discountedPrice),
        discountMinQty: toNumberOrNull(v.discountMinQty),
        bulkDiscount: {
          minQty: toNumberOrNull(v?.bulkDiscount?.minQty),
          price: toNumberOrNull(v?.bulkDiscount?.price),
        },
        quantity: toNumberOrNull(v.quantity),
        images: normalizeImages(v.images),
      }));
  }

  // no duplicate colorVariants for same color
  if (Array.isArray(this.colorVariants)) {
    const seen = new Set();
    for (const v of this.colorVariants) {
      const key = String(v.color);
      if (seen.has(key)) {
        return next(new Error("Each color can only appear once in colorVariants."));
      }
      seen.add(key);
    }
  }

  // validate each color variant pricing
  if (Array.isArray(this.colorVariants)) {
    for (const v of this.colorVariants) {
      const variantPrice =
        v.price !== null && v.price !== undefined ? Number(v.price) : Number(this.price);

      if (Number.isNaN(variantPrice) || variantPrice < 0) {
        return next(new Error("Each color variant price must be a valid number >= 0."));
      }

      if (v.discountedPrice !== null && v.discountedPrice !== undefined) {
        const d = Number(v.discountedPrice);
        if (Number.isNaN(d) || d < 0) {
          return next(new Error("Each color variant discountedPrice must be >= 0."));
        }
        if (!(d < variantPrice)) {
          return next(
            new Error("Each color variant discountedPrice must be less than its variant price.")
          );
        }
      }

      if (v.discountMinQty !== null && v.discountMinQty !== undefined) {
        if (Number(v.discountMinQty) < 1) {
          return next(new Error("Each color variant discountMinQty must be >= 1."));
        }
        if (v.discountedPrice === null || v.discountedPrice === undefined) {
          return next(
            new Error("Each color variant discountMinQty requires discountedPrice to be set.")
          );
        }
      }

      const bdMin = v?.bulkDiscount?.minQty;
      const bdPrice = v?.bulkDiscount?.price;

      const hasBdMin = isPresent(bdMin);
      const hasBdPrice = isPresent(bdPrice);

      if (hasBdMin !== hasBdPrice) {
        return next(
          new Error("Each color variant bulkDiscount requires BOTH minQty and price.")
        );
      }

      if (hasBdMin && hasBdPrice) {
        if (Number(bdMin) < 1) {
          return next(new Error("Each color variant bulkDiscount.minQty must be >= 1."));
        }
        if (Number(bdPrice) < 0) {
          return next(new Error("Each color variant bulkDiscount.price must be >= 0."));
        }
        if (Number(bdPrice) > variantPrice) {
          return next(
            new Error("Each color variant bulkDiscount.price must be <= its variant price.")
          );
        }
      }

      if (v.quantity !== null && v.quantity !== undefined && Number(v.quantity) < 0) {
        return next(new Error("Each color variant quantity must be >= 0."));
      }
    }
  }

  // if not printable -> force printingPrice to null
  if (!this.isPrintable) {
    this.printingPrice = null;
  }

  next();
});

/* =========================
   OPTIONAL: instance helpers
========================= */

/**
 * Returns pricing source for a selected color
 * Falls back to product-level pricing if no color override exists
 *
 * Important fix:
 * If a variant has its own price, inherited product-level discountedPrice
 * and bulkDiscount.price are only used when they are still valid for that
 * variant price.
 */
productSchema.methods.getColorPricing = function (colorId) {
  const variant =
    Array.isArray(this.colorVariants) && colorId
      ? this.colorVariants.find((v) => String(v.color) === String(colorId))
      : null;

  const price =
    variant?.price !== null && variant?.price !== undefined
      ? Number(variant.price)
      : Number(this.price || 0);

  const inheritedDiscountedPrice =
    this.discountedPrice !== null && this.discountedPrice !== undefined
      ? Number(this.discountedPrice)
      : null;

  const inheritedDiscountMinQty =
    this.discountMinQty !== null && this.discountMinQty !== undefined
      ? Number(this.discountMinQty)
      : null;

  const inheritedBulkMinQty =
    this.bulkDiscount?.minQty !== null && this.bulkDiscount?.minQty !== undefined
      ? Number(this.bulkDiscount.minQty)
      : null;

  const inheritedBulkPrice =
    this.bulkDiscount?.price !== null && this.bulkDiscount?.price !== undefined
      ? Number(this.bulkDiscount.price)
      : null;

  const discountedPrice =
    variant?.discountedPrice !== null && variant?.discountedPrice !== undefined
      ? Number(variant.discountedPrice)
      : inheritedDiscountedPrice !== null && inheritedDiscountedPrice < price
      ? inheritedDiscountedPrice
      : null;

  const discountMinQty =
    discountedPrice !== null
      ? variant?.discountMinQty !== null && variant?.discountMinQty !== undefined
        ? Number(variant.discountMinQty)
        : inheritedDiscountMinQty
      : null;

  const bulkPrice =
    variant?.bulkDiscount?.price !== null && variant?.bulkDiscount?.price !== undefined
      ? Number(variant.bulkDiscount.price)
      : inheritedBulkPrice !== null && inheritedBulkPrice <= price
      ? inheritedBulkPrice
      : null;

  const bulkMinQty =
    bulkPrice !== null
      ? variant?.bulkDiscount?.minQty !== null && variant?.bulkDiscount?.minQty !== undefined
        ? Number(variant.bulkDiscount.minQty)
        : inheritedBulkMinQty
      : null;

  const quantity =
    variant?.quantity !== null && variant?.quantity !== undefined
      ? Number(variant.quantity)
      : this.quantity !== null && this.quantity !== undefined
      ? Number(this.quantity)
      : 0;

  return {
    color: variant?.color || null,
    price,
    discountedPrice,
    discountMinQty,
    bulkDiscount: {
      minQty: bulkMinQty,
      price: bulkPrice,
    },
    quantity,
    images:
      variant?.images && variant.images.length > 0
        ? variant.images
        : Array.isArray(this.images)
        ? this.images
        : [],
  };
};

/**
 * Compute unit price by qty, optionally by color
 * Usage:
 * product.getUnitPriceByQty(5) // product normal logic
 * product.getUnitPriceByQty(5, colorId) // color-specific logic
 */
productSchema.methods.getUnitPriceByQty = function (qty = 1, colorId = null) {
  const q = Math.max(1, Number(qty || 1));

  const pricing = this.getColorPricing(colorId);
  const base = Number(pricing.price || 0);

  // 1) bulkDiscount overrides
  const bdMin = pricing.bulkDiscount?.minQty;
  const bdPrice = pricing.bulkDiscount?.price;
  if (bdMin != null && bdPrice != null && q >= Number(bdMin)) {
    return Number(bdPrice);
  }

  // 2) discountedPrice with discountMinQty
  if (pricing.discountedPrice != null) {
    if (pricing.discountMinQty != null && q >= Number(pricing.discountMinQty)) {
      return Number(pricing.discountedPrice);
    }
  }

  // 3) normal/base price
  return base;
};

module.exports = mongoose.model("Product", productSchema);