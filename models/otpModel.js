const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    identity: { type: String, required: true, index: true }, // E164 phone
    codeHash: { type: String, required: true },
    purpose: { type: String, default: "login", index: true },
    expiresAt: { type: Date, required: true, index: true },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// auto-delete expired docs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
