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
    /* =====================
       BASIC INFO
    ===================== */
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    description: {
      type: String,
      required: true,
    },

    /* =====================
       PRICING
    ===================== */
    price: {
      type: Number,
      required: true,
      min: 0,
    },

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

    /* =====================
       CATEGORY & BRAND
    ===================== */
    category: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    brand: {
      type: String,
      required: true,
      trim: true,
    },

    tags: [{ type: String, trim: true }],

    /* =====================
       STOCK & ORDERS
    ===================== */
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    minOrder: {
      type: Number,
      default: null,
      min: 1,
    },

    maxOrder: {
      type: Number,
      default: null,
    },

    sold: {
      type: Number,
      default: 0,
    },

    /* =====================
       PRINTING
    ===================== */
    isPrintable: {
      type: Boolean,
      default: false,
    },

    printingPrice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pprice",
    },

    printSpec: {
      allowedExtensions: {
        type: [String],
        default: ["pdf", "png", "jpg", "jpeg", "cdr", "ai"],
      },
      maxFileSizeMB: {
        type: Number,
        default: 50,
      },
      instructions: {
        type: String,
        default: "",
      },
    },

    /* =====================
       IMAGES
    ===================== */
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],

    /* =====================
       COLOR VARIANTS (KEY PART)
    ===================== */
    hasColorVariants: {
      type: Boolean,
      default: false,
    },

    // same group for same product different colors
    variantGroup: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    // ONE color per product variant
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      index: true,
    },

    /* =====================
       SIZE (optional)
    ===================== */
    size: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Size",
      },
    ],

    /* =====================
       RATINGS
    ===================== */
    ratings: [
      {
        star: { type: Number, min: 1, max: 5 },
        comment: { type: String, trim: true },
        postedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    totalrating: {
      type: Number,
      default: 0,
    },

    /* =====================
       STATUS
    ===================== */
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

/* =====================
   INDEXES
===================== */
productSchema.index({ variantGroup: 1, color: 1 });
productSchema.index({ title: "text", description: "text" });

/* =====================
   METHODS
===================== */
productSchema.methods.getEffectivePrice = function (orderQuantity = 1) {
  if (this.discountedPrice && orderQuantity >= 500) {
    return this.discountedPrice;
  }
  return this.price;
};

module.exports = mongoose.model("Product", productSchema);
