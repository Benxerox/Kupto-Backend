const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var colorSchema = new mongoose.Schema({
    title:{
        type:String,
        required: false,
        unique:true,
        index:true,
    },
    

},
{
timestamps: true,
}
);

//Export the model
module.exports = mongoose.model('Color', colorSchema);