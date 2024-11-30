const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var cartSchema = new mongoose.Schema({
 userId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User'
 },
 productId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Product'
 },
 quantity: {
  type: Number,
  required: true
 },
 price: {
  type: Number,
  required: true
 },
 color: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Color'
 },
 
 size: {
  type: mongoose.Schema.Types.ObjectId, // Use ObjectId here
  ref: 'Size' // Reference the Size model
},
uploadedFiles: [{
  fileName: String,
  public_id: String,
  url: String
}],
instruction: { // Optional instruction field
  type: String,
  required: false // This makes it optional
},
},{
timestamps: true,
});

//Export the model
module.exports = mongoose.model('Cart', cartSchema);