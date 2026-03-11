// models/order.model.js
const mongoose = require("mongoose");

const uploadedFileSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: null, trim: true },
    public_id: { type: String, default: null, trim: true },
    url: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
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

    uploadedFiles: { type: [uploadedFileSchema], default: [] },

    quantity: { type: Number, required: true, min: 1 },

    // ✅ Exact unit price used at checkout (product + print unit)
    unitPrice: { type: Number, required: true, min: 0 },

    // ✅ Optional print breakdown
    printUnitPrice: { type: Number, default: 0, min: 0 },
    printPricingTitle: { type: String, default: null, trim: true },
    printSide: {
      type: String,
      enum: ["oneSide", "twoSide", ""],
      default: "",
    },

    instruction: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    // ✅ Logged-in user optional
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ Guest info for guest checkout
    guestInfo: {
      fullName: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      email: { type: String, trim: true, lowercase: true, default: null },
    },

    // ✅ Shipping + contact info
    shippingInfo: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },

      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },

      address: { type: String, required: true, trim: true },
      region: { type: String, required: true, trim: true },
      subRegion: { type: String, trim: true, default: "" },

      // ✅ Optional delivery helper fields
      deliveryMethod: {
        type: String,
        enum: ["delivery", "pickup"],
        default: "delivery",
        trim: true,
      },
      pickupStation: { type: String, trim: true, default: "" },
    },

    paymentInfo: {
      // ✅ Updated to your 3 frontend payment methods
      paymentMethod: {
        type: String,
        enum: ["cashOnDelivery", "airtelMoney", "mtnMomo"],
        required: true,
        trim: true,
      },

      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
        trim: true,
      },

      // ✅ Mobile money provider auto-maps to Airtel / MTN when needed
      provider: {
        type: String,
        enum: ["MTN", "Airtel", null],
        default: null,
      },

      // ✅ Optional mobile money transaction reference
      transactionId: { type: String, default: null, trim: true },
    },

    note: { type: String, default: null, trim: true },

    // ✅ Items
    orderItems: { type: [orderItemSchema], required: true, default: [] },

    // ✅ Totals
    itemsTotal: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0, default: 0 },
    setupFeeTotal: { type: Number, required: true, min: 0, default: 0 },

    // ✅ Grand totals
    totalPrice: { type: Number, required: true, min: 0 },
    totalPriceAfterDiscount: { type: Number, required: true, min: 0 },

    // ✅ Payment state
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },

    // ✅ Cancellation
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, trim: true },
    cancelledBy: { type: String, enum: ["user", "admin"], default: null },

    // ✅ Month tracking
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1,
    },

    // ✅ Order status
    orderStatus: {
      type: String,
      enum: ["Ordered", "Shipped", "Delivered", "Cancelled"],
      default: "Ordered",
      trim: true,
    },
  },
  { timestamps: true }
);

// ✅ Enforce month from createdAt
orderSchema.pre("save", function (next) {
  if (this.isNew && this.createdAt) {
    this.month = new Date(this.createdAt).getMonth() + 1;
  }
  next();
});

// ✅ Auto-map provider from selected payment method
orderSchema.pre("validate", function (next) {
  if (this.paymentInfo?.paymentMethod === "airtelMoney") {
    this.paymentInfo.provider = "Airtel";
  } else if (this.paymentInfo?.paymentMethod === "mtnMomo") {
    this.paymentInfo.provider = "MTN";
  } else if (this.paymentInfo?.paymentMethod === "cashOnDelivery") {
    this.paymentInfo.provider = null;
    this.paymentInfo.transactionId = null;
  }

  next();
});

// ✅ Safety validation: either logged-in user OR guest contact must exist
orderSchema.pre("validate", function (next) {
  if (!this.user) {
    const g = this.guestInfo || {};
    const hasContact = !!(g.phone || g.email);
    if (!hasContact) {
      this.invalidate(
        "guestInfo.phone",
        "Guest phone or email is required when user is not provided."
      );
    }
  }
  next();
});

// ✅ Pickup validation
orderSchema.pre("validate", function (next) {
  const shipping = this.shippingInfo || {};

  if (shipping.deliveryMethod === "pickup") {
    if (!String(shipping.pickupStation || "").trim()) {
      this.invalidate(
        "shippingInfo.pickupStation",
        "Pickup station is required when delivery method is pickup."
      );
    }
  }

  next();
});

module.exports = mongoose.model("Order", orderSchema);