const mongoose = require('mongoose');

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

module.exports = mongoose.model('Product', productSchema);