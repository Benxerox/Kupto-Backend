const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var ExpenseSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    description: {
        type: String,
        required: true,
    },
    amount: {
        type: Number, // Changed from String to Number
        required: true,
    },
    date: {
        type: Date,
        default: () => Date.now(),
    }
});

// Export the model
module.exports = mongoose.model('Expense', ExpenseSchema);