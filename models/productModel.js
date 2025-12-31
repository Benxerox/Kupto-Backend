// models/productModel.js
const mongoose = require("mongoose");

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

    // ✅ base unit price (current)
    price: { type: Number, required: true, min: 0 },

    /**
     * ✅ optional "old price" for UI strike-through
     * show it only if discountedPrice > price
     */
    discountedPrice: { type: Number, default: null, min: 0 },

    /**
     * ✅ product-level bulk discount (qty-based)
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

          // sanity: bulk price should not exceed base price (optional but recommended)
          if (hasMin && hasPrice) {
            return Number(discPrice) <= Number(this.price);
          }

          return true;
        },
        message:
          "bulkDiscount requires BOTH minQty and price, and bulkDiscount.price must be <= price.",
      },
    },

    category: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    brand: { type: String, required: true, trim: true },

    tags: [{ type: String, trim: true }],

    quantity: { type: Number, required: true, min: 0 },

    /**
     * ✅ order constraints
     */
    minOrder: { type: Number, default: null, min: 1 },

    maxOrder: {
      type: Number,
      default: null,
      min: 1,
      validate: {
        validator: function (v) {
          if (v == null) return true;
          if (this.minOrder == null) return true;
          return Number(v) >= Number(this.minOrder);
        },
        message: "maxOrder must be greater than or equal to minOrder.",
      },
    },

    sold: { type: Number, default: 0 },

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

  // optional cleanup: keep discountedPrice only if it's truly an "old price"
  if (this.discountedPrice != null && Number(this.discountedPrice) <= Number(this.price)) {
    this.discountedPrice = null;
  }

  next();
});

module.exports = mongoose.model("Product", productSchema);
