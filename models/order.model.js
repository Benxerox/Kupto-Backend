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

    unitPrice: { type: Number, required: true, min: 0 },

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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    guestInfo: {
      fullName: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
      email: { type: String, trim: true, lowercase: true, default: null },
    },

    shippingInfo: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },

      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },

      address: { type: String, required: true, trim: true },
      region: { type: String, required: true, trim: true },
      subRegion: { type: String, trim: true, default: "" },

      deliveryMethod: {
        type: String,
        enum: ["delivery", "pickup"],
        default: "delivery",
        trim: true,
      },

      pickupStation: { type: String, trim: true, default: "" },
    },

    paymentInfo: {
      paymentMethod: {
        type: String,
        enum: ["cashOnDelivery", "dpo"],
        required: true,
        trim: true,
      },

      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
        trim: true,
      },

      provider: {
        type: String,
        enum: ["DPO", null],
        default: null,
      },

      transactionId: { type: String, default: null, trim: true },
    },

    note: { type: String, default: null, trim: true },

    orderItems: { type: [orderItemSchema], required: true, default: [] },

    itemsTotal: { type: Number, required: true, min: 0 },
    shippingPrice: { type: Number, required: true, min: 0, default: 0 },
    setupFeeTotal: { type: Number, required: true, min: 0, default: 0 },

    totalPrice: { type: Number, required: true, min: 0 },
    totalPriceAfterDiscount: { type: Number, required: true, min: 0 },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    trackingNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true,
      index: true,
      sparse: true,
    },

    deliveryEstimateStart: {
      type: Date,
      default: null,
    },

    deliveryEstimateEnd: {
      type: Date,
      default: null,
    },

    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },

    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null, trim: true },
    cancelledBy: { type: String, enum: ["user", "admin"], default: null },

    month: {
      type: Number,
      min: 1,
      max: 12,
      default: () => new Date().getMonth() + 1,
    },

    orderStatus: {
      type: String,
      enum: ["Ordered", "Shipped", "Delivered", "Cancelled"],
      default: "Ordered",
      trim: true,
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

orderSchema.pre("validate", function (next) {
  if (this.paymentInfo?.paymentMethod === "dpo") {
    this.paymentInfo.provider = "DPO";
  } else if (this.paymentInfo?.paymentMethod === "cashOnDelivery") {
    this.paymentInfo.provider = null;
    this.paymentInfo.transactionId = null;
    this.paymentInfo.status = "Pending";
    this.isPaid = false;
    this.paidAt = null;
  }

  next();
});

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

orderSchema.pre("validate", function (next) {
  if (
    this.deliveryEstimateStart &&
    this.deliveryEstimateEnd &&
    this.deliveryEstimateEnd < this.deliveryEstimateStart
  ) {
    this.invalidate(
      "deliveryEstimateEnd",
      "deliveryEstimateEnd cannot be earlier than deliveryEstimateStart."
    );
  }

  next();
});

module.exports = mongoose.model("Order", orderSchema);