const mongoose = require("mongoose");

const otherPostSchema = new mongoose.Schema(
  {
    images: [
      {
        imageUrl: {
          type: String,
          required: true, // Cloudinary or direct URL
        },

        public_id: {
          type: String,
          default: "", // Cloudinary public_id
        },

        caption: {
          type: String,
          default: "", // optional text
        },

        link: {
          type: String,
          default: "", // optional link (e.g. /product/123)
        },

        order: {
          type: Number,
          default: 0, // controls display order
        },
      },
    ],

    isActive: {
      type: Boolean,
      default: true, // can hide/show this post group
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OtherPost", otherPostSchema);
