<<<<<<< HEAD
/*const mongoose = require('mongoose'); // Erase if already required


=======
const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
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
<<<<<<< HEAD
module.exports = mongoose.model('Color', colorSchema);*/

const mongoose = require("mongoose");

const colorSchema = new mongoose.Schema(
  {
    /* =====================
       BASIC COLOR INFO
    ===================== */
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true, // "Black", "White", "Royal Blue"
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // "royal-blue"
      index: true,
    },

    /* =====================
       COLOR VALUES (UI + PRINT)
    ===================== */
    hex: {
      type: String,
      required: true,
      uppercase: true,
      match: /^#([0-9A-F]{3}|[0-9A-F]{6})$/,
      index: true,
    },

    // Optional — useful if some colors are patterns/textures
    swatchImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },

    /* =====================
       PRINTING INFO
    ===================== */
    printNotes: {
      type: String,
      default: "",
      // e.g. "White ink required on dark materials"
    },

    /* =====================
       VISIBILITY & ORDER
    ===================== */
    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    /* =====================
       METADATA
    ===================== */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

/* =====================
   INDEXES
===================== */
colorSchema.index({ name: 1 });
colorSchema.index({ hex: 1 });

/* =====================
   METHODS
===================== */
colorSchema.methods.getDisplay = function () {
  return {
    id: this._id,
    name: this.name,
    hex: this.hex,
    swatch: this.swatchImage?.url || null,
  };
};

module.exports = mongoose.model("Color", colorSchema);
=======
module.exports = mongoose.model('Color', colorSchema);
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
