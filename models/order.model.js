// models/order.model.js
/*
const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shippingInfo: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      region: { type: String, required: true, trim: true },
      subRegion: { type: String, required: true, trim: true },
    },

    paymentInfo: {
      paymentMethod: {
        type: String,
        enum: ["PayPal", "Cash on Delivery", "MTN", "Airtel"],
        required: true,
        trim: true,
      },

      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
      },

      paypalOrderID: {
        type: String,
        default: null,
        required: function () {
          return this.paymentMethod === "PayPal";
        },
      },

      paypalCaptureID: { type: String, default: null },
      paypalPayerID: { type: String, default: null },
    },

    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        color: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Color",
          required: false,
        },

        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: false,
        },

        uploadedFiles: [
          {
            fileName: { type: String, default: null },
            public_id: { type: String, default: null },
            url: { type: String, default: null },
          },
        ],

        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        instruction: { type: String, default: null },
      },
    ],

    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },

    month: {
      type: Number,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1,
    },

    totalPrice: { type: Number, required: true, min: 0 },
    totalPriceAfterDiscount: { type: Number, required: true, min: 0 },

    orderStatus: {
      type: String,
      enum: ["Ordered", "Shipped", "Delivered", "Cancelled"],
      default: "Ordered",
    },
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (this.isNew && this.createdAt) {
    this.month = new Date(this.createdAt).getMonth() + 1;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
*/
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

    // ✅ Store the exact unit price you used at checkout (product + print unit)
    unitPrice: { type: Number, required: true, min: 0 },

    // ✅ Optional print breakdown (for printing products)
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
    // ✅ Allow guest checkout (user can be null)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ Guest identity (optional, but useful for orders without user)
    guestInfo: {
      fullName: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      email: { type: String, trim: true, lowercase: true, default: null },
    },

    // ✅ Shipping + contact info (required for all orders)
    shippingInfo: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },

      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },

      address: { type: String, required: true, trim: true },
      region: { type: String, required: true, trim: true },
      // ✅ optional (you had it optional in the new schema)
      subRegion: { type: String, trim: true, default: "" },
    },

    paymentInfo: {
      // ✅ Keep your new normalized methods
      paymentMethod: {
        type: String,
        enum: ["cashOnDelivery", "mobileMoney", "card", "paypal"],
        required: true,
        trim: true,
      },

      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
        trim: true,
      },

      // ✅ PayPal fields (conditionally required)
      paypalOrderID: {
        type: String,
        default: null,
        required: function () {
          return this.paymentMethod === "paypal";
        },
      },
      paypalCaptureID: { type: String, default: null },
      paypalPayerID: { type: String, default: null },

      // ✅ Mobile money fields (optional)
      provider: {
        type: String,
        enum: ["MTN", "Airtel", null],
        default: null,
      },
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

    // ✅ Month tracking (keep from old schema)
    month: {
      type: Number,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1,
    },

    // ✅ Order status (keep from old schema)
    orderStatus: {
      type: String,
      enum: ["Ordered", "Shipped", "Delivered", "Cancelled"],
      default: "Ordered",
      trim: true,
    },
  },
  { timestamps: true }
);

// ✅ Enforce month based on createdAt (keep your old behavior)
orderSchema.pre("save", function (next) {
  if (this.isNew && this.createdAt) {
    this.month = new Date(this.createdAt).getMonth() + 1;
  }
  next();
});

// ✅ Safety validation: must be either logged-in user OR have guest info (optional but recommended)
orderSchema.pre("validate", function (next) {
  // If no user, we expect at least guest phone or email (so you can contact them)
  if (!this.user) {
    const g = this.guestInfo || {};
    const hasContact = !!(g.phone || g.email);
    if (!hasContact) {
      // Not required by your earlier schema, but protects you from anonymous orders
      this.invalidate("guestInfo.phone", "Guest phone or email is required when user is not provided.");
    }
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
