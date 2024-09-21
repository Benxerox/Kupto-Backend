const mongoose = require('mongoose'); // Erase if already required

var priSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
 
  mobile: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
  },
  instruction: {
    type: String,
    required: true,
  },
  uploadedFiles: [{
    fileName: String,
    public_id: String,
    url: String
  }],
  status: {
    type:String,
    default: "Submitted",
    enum:['Submitted','Contacted','Submitted',"In Progress", "Resolved"]
  }
});

// Export the model
module.exports = mongoose.model('Print', priSchema);