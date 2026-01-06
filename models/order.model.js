// models/order.model.js
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

      // ✅ Common fields for ANY method
      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending",
      },

      // ✅ PayPal-specific
      paypalOrderID: {
        type: String,
        default: null,
        required: function () {
          return this.paymentMethod === "PayPal";
        },
      },

      // If you're using PayPal REST (paypal-rest-sdk), this is usually "payment.id"
      // If you're using PayPal Checkout v2, you'd store "capture.id" here.
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

        // ✅ Size ref (since you decided to ref "Size")
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

    // ✅ Payment flags
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },

    // ✅ Helpful for analytics (month of creation)
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

// Optional: keep month always aligned with createdAt
orderSchema.pre("save", function (next) {
  if (this.isNew && this.createdAt) {
    this.month = new Date(this.createdAt).getMonth() + 1;
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
