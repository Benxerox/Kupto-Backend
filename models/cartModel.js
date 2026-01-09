const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    // ✅ Base product unit price (what you already store)
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      default: null,
    },

    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Size",
      default: null,
    },

    // ✅ Variant image (selected color/variant image on frontend)
    variantImage: {
      type: String,
      default: "",
      trim: true,
    },

    // ✅ Uploaded artwork files (for print orders)
    uploadedFiles: [
      {
        fileName: { type: String, default: "" },
        public_id: { type: String, default: "" },
        url: { type: String, default: "" },
      },
    ],

    // ✅ Customer instruction/notes
    instruction: {
      type: String,
      default: null,
      trim: true,
    },

    // =========================
    // ✅ PRINTING / EMBROIDERY FIELDS
    // =========================

    // e.g. "oneSide" | "twoSide"
    printSide: {
      type: String,
      default: "",
      trim: true,
    },

    // price per side (or per unit) for the print option
    printUnitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // reference key to the print price record (what your frontend sends)
    // e.g. "pprice:69611068c6ce33b5056fb1be"
    printKey: {
      type: String,
      default: "",
      trim: true,
    },

    // readable title (e.g. "Embroidery", "DTF", "Screen Printing")
    printPricingTitle: {
      type: String,
      default: "",
      trim: true,
    },

    // one-time setup/preparation fee (only once, not multiplied by qty)
    preparePriceOnce: {
      type: Number,
      default: 0,
      min: 0,
    },

    // flag to indicate prep fee applied (so you don't apply it again)
    preparePriceApplied: {
      type: Boolean,
      default: false,
    },

    // min qty for discount (optional)
    printDiscountMinQty: {
      type: Number,
      default: null,
      min: 1,
    },
  },
  { timestamps: true }
);

// Export the model
module.exports = mongoose.model("Cart", cartSchema);
