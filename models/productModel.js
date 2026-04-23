// models/productModel.js
const mongoose = require("mongoose");
const slugify = require("slugify");

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
  if (!ctx) return undefined;

  // 1) Document context
  if (ctx[field] !== undefined) return ctx[field];

  // 2) Query/update context
  const u = getUpdate(ctx);
  if (!u) return undefined;

  // direct
  if (u[field] !== undefined) return u[field];

  // $set / $setOnInsert
  if (u.$set && u.$set[field] !== undefined) {
    return u.$set[field];
  }
  if (u.$setOnInsert && u.$setOnInsert[field] !== undefined) {
    return u.$setOnInsert[field];
  }

  return undefined;
};

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
   Each color can have:
   - optional own price
   - optional own discountedPrice
   - optional own discountMinQty
   - optional own quantity
   - optional own images

   NOTE:
   - If color price is null => fallback to product price
   - If color discountedPrice is null => can fall back to product discountedPrice
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
      trim: true,
      index: true,
    },

    description: { type: String, required: true },

    /* =========================
       PRICING
       - price = base (normal) unit price
       - discountedPrice = sale unit price
       - discountMinQty = qty at which discountedPrice activates
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
          if (price !== null && price !== undefined && price !== "") {
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
          return disc !== null && disc !== undefined && disc !== "";
        },
        message: "discountMinQty requires discountedPrice to be set.",
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
          if (minOrder === null || minOrder === undefined || minOrder === "") {
            return true;
          }

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

    color: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color" }],
    size: [{ type: mongoose.Schema.Types.ObjectId, ref: "Size" }],

    /**
     * colorVariants:
     * Each selected color can have:
     * - its own price
     * - its own discount
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
        postedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
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
productSchema.index({ slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ color: 1 });
productSchema.index({ "colorVariants.color": 1 });

/* =========================
   Guards / cleanup
========================= */
productSchema.pre("validate", function (next) {
  // auto-generate slug from title
  if (this.title) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      trim: true,
    });
  }

  // normalize top-level numeric nullable fields
  this.discountedPrice = toNumberOrNull(this.discountedPrice);
  this.discountMinQty = toNumberOrNull(this.discountMinQty);
  this.minOrder = toNumberOrNull(this.minOrder);
  this.maxOrder = toNumberOrNull(this.maxOrder);

  // normalize top-level images
  if (Array.isArray(this.images)) {
    this.images = normalizeImages(this.images);
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
        v.price !== null && v.price !== undefined
          ? Number(v.price)
          : Number(this.price);

      if (Number.isNaN(variantPrice) || variantPrice < 0) {
        return next(
          new Error("Each color variant price must be a valid number >= 0.")
        );
      }

      if (v.discountedPrice !== null && v.discountedPrice !== undefined) {
        const d = Number(v.discountedPrice);

        if (Number.isNaN(d) || d < 0) {
          return next(
            new Error("Each color variant discountedPrice must be >= 0.")
          );
        }

        if (!(d < variantPrice)) {
          return next(
            new Error(
              "Each color variant discountedPrice must be less than its variant price."
            )
          );
        }
      }

      if (v.discountMinQty !== null && v.discountMinQty !== undefined) {
        if (Number(v.discountMinQty) < 1) {
          return next(
            new Error("Each color variant discountMinQty must be >= 1.")
          );
        }

        if (v.discountedPrice === null || v.discountedPrice === undefined) {
          return next(
            new Error(
              "Each color variant discountMinQty requires discountedPrice to be set."
            )
          );
        }
      }

      if (
        v.quantity !== null &&
        v.quantity !== undefined &&
        Number(v.quantity) < 0
      ) {
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
 * Rules:
 * - color price falls back to product price
 * - color discountedPrice falls back to product discountedPrice
 *   only if inherited discountedPrice is still valid for the final price
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
 *
 * Logic:
 * - if qty >= discountMinQty and discountedPrice exists -> use discountedPrice
 * - otherwise use normal price
 */
productSchema.methods.getUnitPriceByQty = function (qty = 1, colorId = null) {
  const q = Math.max(1, Number(qty || 1));

  const pricing = this.getColorPricing(colorId);
  const base = Number(pricing.price || 0);

  if (
    pricing.discountedPrice != null &&
    pricing.discountMinQty != null &&
    q >= Number(pricing.discountMinQty)
  ) {
    return Number(pricing.discountedPrice);
  }

  return base;
};

module.exports = mongoose.model("Product", productSchema);