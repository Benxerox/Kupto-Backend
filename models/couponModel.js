const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var couponSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true,
        uppercase: true,
        trim: true, // Added trim to remove any surrounding whitespace
    },
    expiry:{
        type:Date,
        required:true,
    },
    discount:{
        type: Number,
        required:true,
        min: 0,
    },
});

//Export the model
module.exports = mongoose.model('Coupon', couponSchema);