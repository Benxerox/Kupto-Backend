const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
    },

    lastname: {
      type: String,
      required: true,
      trim: true,
    },

    // optional email (unique only if provided)
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true, // allows multiple users without email
    },

    // required phone
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // optional date of birth
    dob: {
      type: Date,
      default: null,
    },

    // google auth support
    provider: {
      type: String,
      default: "local",
      enum: ["local", "google"],
    },

    googleId: {
      type: String,
      default: undefined,
      index: true,
      sparse: true,
      trim: true,
    },

    picture: {
      type: String,
      default: "",
      trim: true,
    },

    // password required only for non-google accounts
    password: {
      type: String,
      required: function () {
        return this.provider !== "google";
      },
      select: false, // extra security
    },

    role: {
      type: String,
      default: "user",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    cart: {
      type: Array,
      default: [],
    },

    address: {
      type: String,
      default: "",
      trim: true,
    },

    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    /**
     * NEW MULTI DEVICE LOGIN SUPPORT
     * Each device/browser gets its own refresh token
     */
    refreshTokens: {
      type: [String],
      default: [],
    },

    /**
     * LEGACY TOKEN (for old users)
     * kept temporarily so old sessions still work
     */
    refreshToken: {
      type: String,
      default: "",
      select: false,
    },

    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   NORMALIZE OPTIONAL FIELDS
========================================================= */
userSchema.pre("save", function (next) {
  if (this.email === "") this.email = undefined;
  if (this.googleId === "") this.googleId = undefined;
  next();
});

/* =========================================================
   PASSWORD HASH
========================================================= */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  // skip hashing if google account has no password
  if (!this.password) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }

  next();
});

/* =========================================================
   PASSWORD COMPARE
========================================================= */
userSchema.methods.isPasswordMatched = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

/* =========================================================
   PASSWORD RESET TOKEN
========================================================= */
userSchema.methods.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes

  return resetToken;
};

/* =========================================================
   EXPORT MODEL
========================================================= */
module.exports = mongoose.model("User", userSchema);