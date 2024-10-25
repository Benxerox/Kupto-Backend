const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  shippingInfo: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    region: {
      type: String,
      required: true,
    },
    subRegion: {
      type: String,
      required: true,
    },
  },
  paymentInfo: {
    paymentMethod: {
      type: String,
      enum: ['PayPal', 'Cash on Delivery', 'Mobile Money'],
      required: true,
    },
    paypalOrderID: {
      type: String,
      required: function() { return this.paymentMethod === 'PayPal'; },
    },
    paypalPaymentID: {
      type: String,
      required: function() { return this.paymentMethod === 'PayPal'; },
    }
  },
  orderItems: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      color: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Color',
        required: true,
      },
      size: {
        type: String
      },
      uploadedFiles: [{
        fileName: String,
        public_id: String,
        url: String
      }],
      quantity: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
      instruction: {
        type: String,
        default: null,
      },
    }
  ],
  paidAt: {
    type: Date,
    default: () => Date.now(),
  },
  month: {
    type: Number, // Store month as an integer (1-12)
    default: () => new Date().getMonth() + 1,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  totalPriceAfterDiscount: {
    type: Number,
    required: true,
  },
  orderStatus: {
    type: String,
    enum: ['Ordered', 'Shipped', 'Delivered', 'Cancelled'], // Example statuses
    default: 'Ordered',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);