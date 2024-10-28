const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
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
        // unique: true, // Consider removing this
    },
    price: {
        type: Number,
        required: true,
    },
    discountedPrice: {
        type: Number,
        default: null,
    },
    design: {
        type: Number,
        default: null,
    },
    category: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', // Refers to the Category model
    }],
    brand: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    sold: {
        type: Number,
        default: 0,
    },
    printingPrice: {
      type: Number,
      default: 0,
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
    tags: [String], // Changed to an array
    ratings: [{
        star: Number,
        comment: String,
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    }],
    totalrating: {
        type: Number, // Changed to Number
        default: 0,
    }
}, { timestamps: true });

// Method to get the effective price based on order quantity
productSchema.methods.getEffectivePrice = function(orderQuantity) {
    return orderQuantity > 500 ? this.discountedPrice : this.price;
};

// Export the model
module.exports = mongoose.model('Product', productSchema);