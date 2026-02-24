const mongoose = require("mongoose");

// Declare the Schema of the Mongo model
const brandSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Brand name is required"],
      unique: true,
      trim: true,
      index: true,
    },

    // Brand Logo / Images
    images: [
      {
        public_id: {
          type: String,
        },
        url: {
          type: String,
        },
      },
    ],

    // Optional: enable/disable brand (useful later)
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Handle duplicate key error nicely
brandSchema.post("save", function (error, doc, next) {
  if (error?.code === 11000) {
    next(new Error("Brand name already exists"));
  } else {
    next(error);
  }
});

module.exports = mongoose.model("Brand", brandSchema);