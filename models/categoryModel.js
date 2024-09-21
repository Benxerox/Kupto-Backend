const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model

var categorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    images: [{
        public_id: String,
        url: String,
    }],
}, );

module.exports = mongoose.model('Category', categorySchema);