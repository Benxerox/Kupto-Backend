const mongoose = require("mongoose");

const otherPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ ADD THIS
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    images: [
      {
        imageUrl: { type: String, required: true },
        public_id: { type: String, default: "" },
        caption: { type: String, default: "" },
        link: { type: String, default: "" },
        order: { type: Number, default: 0 },
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OtherPost", otherPostSchema);
