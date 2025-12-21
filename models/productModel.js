/*const mongoose = require('mongoose');

var productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    discountedPrice: {
        type: Number,
        default: null,
    },
    category: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
    }],
    brand: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    minOrder: {
        type: Number,
        required: false,
        default: null,
    },
    maxOrder: {
        type: Number,
        required: false,
        default: null,
    },
    sold: {
        type: Number,
        default: 0,
    },
    printingPrice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pprice',
    },
    images: [{
        public_id: String,
        url: String,
    }],
    color: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Color'
    }],
    size: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Size',
    }],
    tags: [String], 
    ratings: [{
        star: Number,
        comment: String,
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    }],
    totalrating: {
        type: Number, 
        default: 0,
    }
}, { timestamps: true });


productSchema.methods.getEffectivePrice = function(orderQuantity) {
    return orderQuantity > 500 ? this.discountedPrice : this.price;
};

module.exports = mongoose.model('Product', productSchema);*/
const mongoose = require("mongoose");

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

    price: { type: Number, required: true, min: 0 },

    discountedPrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || v <= this.price;
        },
        message: "Discounted price cannot be higher than price",
      },
    },

    category: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    // NOTE: Schema says brand is String (store the brand name/title)
    brand: { type: String, required: true, trim: true },

    tags: [{ type: String, trim: true }],

    quantity: { type: Number, required: true, min: 0 },

    minOrder: { type: Number, default: null, min: 1 },

    maxOrder: { type: Number, default: null, min: 1 },

    sold: { type: Number, default: 0 },

    isPrintable: { type: Boolean, default: false },

    // ✅ single selectable print type (or null)
    printingPrice: { type: mongoose.Schema.Types.ObjectId, ref: "Pprice", default: null },

    printSpec: {
      allowedExtensions: {
        type: [String],
        default: ["pdf", "png", "jpg", "jpeg", "cdr", "ai"],
      },
      maxFileSizeMB: { type: Number, default: 50 },
      instructions: { type: String, default: "", trim: true },
    },

    // default images for the product (fallback)
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],

    // ✅ selectable colors & sizes
    color: [{ type: mongoose.Schema.Types.ObjectId, ref: "Color", index: true }],

    size: [{ type: mongoose.Schema.Types.ObjectId, ref: "Size" }],

    // ✅ images per color (variant gallery)
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
        star: { type: Number, min: 1, max: 5 },
        comment: { type: String, trim: true },
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
   1) variantImages only allowed for colors in product.color
   2) ensure printingPrice is null if isPrintable is false
========================= */
productSchema.pre("validate", function (next) {
  // keep variantImages consistent with selected colors
  if (Array.isArray(this.variantImages) && Array.isArray(this.color)) {
    const allowed = new Set(this.color.map(String));

    this.variantImages = this.variantImages
      // remove entries whose color isn't in product.color
      .filter((v) => v?.color && allowed.has(String(v.color)))
      // optional: remove empty image lists
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

module.exports = mongoose.model("Product", productSchema);
