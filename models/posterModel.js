const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var posterSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        unique: true,
    },
    images: [{
        public_id: String,
        url: String,
    }],
    date: {
        type: Date,
        required: true,
        default: Date.now
    }
}, { timestamps: true });

// Export the model
module.exports = mongoose.model('Poster', posterSchema);