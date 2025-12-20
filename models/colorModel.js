/*const mongoose = require('mongoose'); // Erase if already required


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
module.exports = mongoose.model('Color', colorSchema);*/

const mongoose = require("mongoose");
const slugify = require("slugify");

const hexRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/;

const colorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 60,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },

    hex: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: hexRegex,
      index: true,
    },

    swatchImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },


    printNotes: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// ✅ Always generate slug + normalize hex before validation
colorSchema.pre("validate", function (next) {
  if (this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true, trim: true });
  }
  if (this.hex) {
    this.hex = this.hex.toUpperCase().trim();
  }
  next();
});

// Optional helper
colorSchema.methods.getDisplay = function () {
  return {
    id: this._id,
    name: this.name,
    hex: this.hex,
    swatch: this.swatchImage?.url || null,
    isActive: this.isActive,
    sortOrder: this.sortOrder,
  };
};

module.exports = mongoose.model("Color", colorSchema);
