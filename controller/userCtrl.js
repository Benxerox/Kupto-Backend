// controllers/userCtrl.js
const User = require("../models/userModel");
const Product = require("../models/productModel");
const Cart = require("../models/cartModel");
const Coupon = require("../models/couponModel");
const Order = require("../models/order.model");

const uniqid = require("uniqid");
const asyncHandler = require("express-async-handler");
const { generateToken } = require("../config/jwtToken");
const validateMongoDbId = require("../utils/validateMongodbid");
const { generateRefreshToken } = require("../config/refreshToken");

const jwt = require("jsonwebtoken");
const sendEmail = require("./emailCtrl");
const crypto = require("crypto");
const mongoose = require("mongoose");

const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ============================
// ✅ Helpers
// ============================
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

// ✅ Uganda E.164 normalization (+2567xxxxxxxx)
const normalizeMobile = (raw = "") => {
  let s = String(raw || "").trim().replace(/[^\d+]/g, "");
  if (!s) return "";

  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+256")) return s;
  if (s.startsWith("256")) return "+" + s;

  if (s.startsWith("0")) {
    const rest = s.replace(/^0+/, "");
    return `+256${rest}`;
  }

  if (/^\d+$/.test(s) && s.length >= 7 && s.length <= 9) return `+256${s}`;
  if (s.startsWith("+")) return s;

  return "";
};

const normalizeMinQty = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
};

const isMongoDupError = (err) =>
  err && (err.code === 11000 || err?.name === "MongoServerError");

const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === "production";
  const isCrossSite =
    String(process.env.CROSS_SITE_COOKIES || "").toLowerCase() === "true";
  const cookieDomain = process.env.COOKIE_DOMAIN; // e.g. ".kupto2020.com"

  const base = {
    httpOnly: true,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };

  if (isProd && isCrossSite) return { ...base, secure: true, sameSite: "none" };
  return { ...base, secure: isProd, sameSite: "lax" };
};

const getClearCookieOptions = () => {
  const opts = getCookieOptions();
  return {
    httpOnly: opts.httpOnly,
    path: opts.path,
    secure: opts.secure,
    sameSite: opts.sameSite,
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
};

const invalidCreds = (res) => {
  res.status(401);
  throw new Error("Invalid Credentials");
};

const toId = (v) => (v && typeof v === "object" ? v._id : v);

const ORDER_STATUSES = ["Ordered", "Shipped", "Delivered", "Cancelled"];

const toMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const requirePositiveMoney = (v, fieldName = "amount") => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error(`${fieldName} must be a positive number`);
    err.statusCode = 400;
    throw err;
  }
  return n;
};

// ============================
// ✅ REGISTER
// ============================
const registerUserCtrl = asyncHandler(async (req, res) => {
  const { firstname, lastname, email, mobile, dob, password } = req.body;

  if (!firstname || !lastname || !mobile || !dob || !password) {
    res.status(400);
    throw new Error("firstname, lastname, mobile, dob and password are required");
  }

  const cleanEmail = email ? normalizeEmail(email) : undefined;
  const cleanMobile = normalizeMobile(mobile);

  if (!cleanMobile) {
    res.status(400);
    throw new Error("mobile is not valid");
  }

  const or = [{ mobile: cleanMobile }];
  if (cleanEmail) or.push({ email: cleanEmail });

  const exists = await User.findOne({ $or: or });
  if (exists) {
    res.status(409);
    throw new Error("User already exists with this email or phone");
  }

  try {
    const newUser = await User.create({
      firstname: String(firstname).trim(),
      lastname: String(lastname).trim(),
      email: cleanEmail,
      mobile: cleanMobile,
      dob: new Date(dob),
      password,
    });

    const refreshToken = generateRefreshToken(newUser._id);
    newUser.refreshToken = refreshToken;
    await newUser.save();

    res.cookie("refreshToken", refreshToken, getCookieOptions());

    return res.status(201).json({
      success: true,
      id: newUser._id,
      firstname: newUser.firstname,
      lastname: newUser.lastname,
      email: newUser.email,
      mobile: newUser.mobile,
      token: generateToken(newUser._id),
    });
  } catch (err) {
    if (isMongoDupError(err)) {
      res.status(409);
      throw new Error("Email or phone already exists");
    }
    throw err;
  }
});

// ============================
// ✅ LOGIN (email OR phone)
// ============================
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { identity, type, email, mobile, password } = req.body;

  const incomingIdentity = identity || email || mobile;
  const incomingType =
    type ||
    (identity && String(identity).includes("@") ? "email" : "phone") ||
    (email ? "email" : "phone");

  if (!incomingIdentity || !password) {
    res.status(400);
    throw new Error("identity and password are required");
  }

  const query =
    incomingType === "email"
      ? { email: normalizeEmail(incomingIdentity) }
      : { mobile: normalizeMobile(incomingIdentity) };

  const user = await User.findOne(query).select("+password");
  if (!user) return invalidCreds(res);

  if (user.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  const ok = await user.isPasswordMatched(password);
  if (!ok) return invalidCreds(res);

  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("refreshToken", refreshToken, getCookieOptions());

  res.json({
    success: true,
    id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    mobile: user.mobile,
    token: generateToken(user._id),
  });
});

// ============================
// ✅ GOOGLE LOGIN
// ============================
const googleLoginCtrl = asyncHandler(async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    res.status(400);
    throw new Error("Missing Google credential");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  const googleId = payload?.sub;
  const email = payload?.email;
  const emailVerified = payload?.email_verified;
  const fullName = payload?.name || "";
  const picture = payload?.picture || "";

  if (!email || !emailVerified) {
    res.status(401);
    throw new Error("Google email is not verified");
  }

  const cleanEmail = normalizeEmail(email);
  let user = await User.findOne({ email: cleanEmail });

  if (!user) {
    const parts = String(fullName).trim().split(" ");
    const firstname = parts[0] || "Kupto";
    const lastname = parts.slice(1).join(" ") || "User";

    return res.status(200).json({
      success: true,
      profileRequired: true,
      message: "Complete profile to finish signup",
      googleProfile: { googleId, email: cleanEmail, firstname, lastname, picture },
    });
  }

  if (user.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  const refreshToken = generateRefreshToken(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("refreshToken", refreshToken, getCookieOptions());

  res.json({
    success: true,
    profileRequired: false,
    id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    email: user.email,
    mobile: user.mobile,
    token: generateToken(user._id),
  });
});

// ============================
// ✅ IDENTIFY USER
// ============================
const identifyUserCtrl = asyncHandler(async (req, res) => {
  const { identity, type } = req.body;

  if (!identity) {
    return res.status(400).json({ exists: false, message: "identity is required" });
  }

  const v = String(identity).trim();

  let user = null;
  let normalized = "";
  let outType = "phone";

  if (type === "email" || v.includes("@")) {
    outType = "email";
    normalized = normalizeEmail(v);
    user = await User.findOne({ email: normalized }).select("_id email mobile");
  } else {
    outType = "phone";
    normalized = normalizeMobile(v);

    const digits = normalized.replace(/[^\d]/g, "");
    const national = digits.startsWith("256") ? digits.slice(3) : digits;
    const legacy0 = national ? "0" + national : "";

    const candidates = [
      normalized,
      digits,
      national,
      legacy0,
      v.replace(/[^\d+]/g, ""),
    ].filter(Boolean);

    user = await User.findOne({ mobile: { $in: candidates } }).select(
      "_id email mobile"
    );
  }

  return res.status(200).json({
    exists: Boolean(user),
    type: outType,
    normalized,
  });
});

// ============================
// ✅ ADMIN LOGIN
// ============================
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const findAdmin = await User.findOne({ email: normalizeEmail(email) }).select(
    "+password"
  );

  if (!findAdmin || findAdmin.role !== "admin") {
    res.status(403);
    throw new Error("Not Authorized");
  }

  if (findAdmin.isBlocked) {
    res.status(403);
    throw new Error("Account is blocked");
  }

  const passwordMatch = await findAdmin.isPasswordMatched(password);
  if (!passwordMatch) return invalidCreds(res);

  const refreshToken = generateRefreshToken(findAdmin._id);
  findAdmin.refreshToken = refreshToken;
  await findAdmin.save();

  res.cookie("refreshToken", refreshToken, getCookieOptions());

  res.json({
    success: true,
    id: findAdmin._id,
    firstname: findAdmin.firstname,
    lastname: findAdmin.lastname,
    email: findAdmin.email,
    mobile: findAdmin.mobile,
    token: generateToken(findAdmin._id),
  });
});

// ============================
// ✅ HANDLE REFRESH TOKEN (rotates refresh token)
// ✅ IMPORTANT: if you DON'T have JWT_REFRESH_SECRET, then verify with JWT_SECRET
// ============================
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) {
    res.status(401);
    throw new Error("No Refresh Token in Cookies");
  }

  const refreshToken = cookie.refreshToken;

  const user = await User.findOne({ refreshToken });
  if (!user) {
    res.status(401);
    throw new Error("No Refresh Token Present in DB or not matched");
  }

  try {
    // If you use a separate secret for refresh, set JWT_REFRESH_SECRET and use it.
    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    const decoded = jwt.verify(refreshToken, refreshSecret);

    if (String(user._id) !== String(decoded.id)) {
      res.status(401);
      throw new Error("There is something wrong with the refresh token");
    }

    const newRefreshToken = generateRefreshToken(user._id);
    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("refreshToken", newRefreshToken, getCookieOptions());

    const accessToken = generateToken(user._id);
    res.json({ token: accessToken, accessToken });
  } catch (err) {
    res.status(401);
    throw new Error("Invalid or expired refresh token");
  }
});

// ============================
// ✅ LOGOUT
// ============================
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) return res.sendStatus(204);

  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });

  if (!user) {
    res.clearCookie("refreshToken", getClearCookieOptions());
    return res.sendStatus(204);
  }

  await User.findOneAndUpdate({ refreshToken }, { refreshToken: "" });
  res.clearCookie("refreshToken", getClearCookieOptions());

  res.sendStatus(204);
});

// ============================
// ✅ UPDATE USER
// ============================
const updatedUser = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const payload = {
      firstname: req?.body?.firstname,
      lastname: req?.body?.lastname,
      email: req?.body?.email ? normalizeEmail(req.body.email) : undefined,
      mobile: req?.body?.mobile ? normalizeMobile(req.body.mobile) : undefined,
    };

    if (req?.body?.mobile && !payload.mobile) {
      res.status(400);
      throw new Error("mobile is not valid");
    }

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const user = await User.findByIdAndUpdate(_id, payload, { new: true }).select(
      "-password -refreshToken"
    );

    res.json(user);
  } catch (error) {
    if (isMongoDupError(error)) {
      res.status(409);
      throw new Error("Email or phone already exists");
    }
    throw new Error(error);
  }
});

// ============================
// ✅ SAVE ADDRESS
// ============================
const saveAddress = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const user = await User.findByIdAndUpdate(
    _id,
    { address: req?.body?.address },
    { new: true }
  ).select("-password -refreshToken");

  res.json(user);
});

// ============================
// ✅ GET ALL USERS
// ============================
const getallUser = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");
  res.json(users);
});

// ============================
// ✅ GET SINGLE USER
// ============================
const getaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findById(id).select("-password -refreshToken");
  res.json({ getaUser: user });
});

// ============================
// ✅ DELETE USER
// ============================
const deleteaUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findByIdAndDelete(id).select("-password -refreshToken");
  res.json({ deleteaUser: user });
});

// ============================
// ✅ BLOCK / UNBLOCK
// ============================
const blockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const user = await User.findByIdAndUpdate(id, { isBlocked: true }, { new: true });
  res.json(user);
});

const unblockUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  await User.findByIdAndUpdate(id, { isBlocked: false }, { new: true });
  res.json({ message: "User UnBlocked" });
});

// ============================
// ✅ UPDATE PASSWORD
// ============================
const updatePassword = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { password } = req.body;
  validateMongoDbId(_id);

  const user = await User.findById(_id).select("+password");
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (password) {
    user.password = password;
    const updatedPassword = await user.save();
    res.json({ success: true, message: "Password updated", id: updatedPassword._id });
  } else {
    res.json({ success: true, message: "No password provided" });
  }
});

// ============================
// ✅ WISHLIST
// ============================
const getWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const user = await User.findById(_id).populate("wishlist");
  res.json(user);
});

const removeProductFromWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(prodId);

  const user = await User.findByIdAndUpdate(
    _id,
    { $pull: { wishlist: prodId } },
    { new: true }
  ).populate("wishlist");

  res.json(user);
});

// ============================
// ✅ CART
// ============================
const userCart = asyncHandler(async (req, res) => {
  const {
    productId,
    color,
    quantity,
    size,
    price,
    uploadedFiles,
    instruction,
    variantImage,
    printSide,
    printUnitPrice,
    printKey,
    printPricingTitle,
    preparePriceOnce,
    preparePriceApplied,
    printDiscountMinQty,
  } = req.body;

  const { _id } = req.user;
  validateMongoDbId(_id);
  validateMongoDbId(productId);

  const qty = Math.max(1, Number(quantity || 1));

  const cleanPrintDiscountMinQty =
    printDiscountMinQty !== undefined ? normalizeMinQty(printDiscountMinQty) : undefined;

  const existing = await Cart.findOne({
    userId: _id,
    productId,
    color: color || null,
    size: size || null,
    printSide: printSide || "",
    printKey: printKey || "",
  });

  if (existing) {
    existing.quantity = Number(existing.quantity || 0) + qty;

    if (price != null) existing.price = Number(price);
    if (variantImage != null) existing.variantImage = variantImage;

    existing.instruction = instruction ?? existing.instruction ?? null;

    existing.printSide = printSide ?? existing.printSide ?? "";
    existing.printUnitPrice =
      printUnitPrice != null ? Number(printUnitPrice) : Number(existing.printUnitPrice || 0);

    existing.printKey = printKey ?? existing.printKey ?? "";
    existing.printPricingTitle = printPricingTitle ?? existing.printPricingTitle ?? "";

    existing.preparePriceOnce =
      preparePriceOnce != null ? Number(preparePriceOnce) : Number(existing.preparePriceOnce || 0);

    existing.preparePriceApplied =
      preparePriceApplied != null
        ? Boolean(preparePriceApplied)
        : Boolean(existing.preparePriceApplied);

    if (cleanPrintDiscountMinQty !== undefined) {
      existing.printDiscountMinQty = cleanPrintDiscountMinQty;
    }

    if (Array.isArray(uploadedFiles) && uploadedFiles.length) {
      existing.uploadedFiles = [...(existing.uploadedFiles || []), ...uploadedFiles];
    }

    await existing.save();
    return res.json(existing);
  }

  const newCart = await Cart.create({
    userId: _id,
    productId,
    color: color || null,
    size: size || null,
    price: Number(price),
    quantity: qty,
    uploadedFiles: Array.isArray(uploadedFiles) ? uploadedFiles : [],
    instruction: instruction ?? null,

    variantImage: variantImage ?? "",
    printSide: printSide ?? "",
    printUnitPrice: Number(printUnitPrice || 0),
    printKey: printKey ?? "",
    printPricingTitle: printPricingTitle ?? "",
    preparePriceOnce: Number(preparePriceOnce || 0),
    preparePriceApplied: Boolean(preparePriceApplied || false),

    printDiscountMinQty: normalizeMinQty(printDiscountMinQty),
  });

  return res.json(newCart);
});

const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const cart = await Cart.find({ userId: _id })
    .populate("productId")
    .populate("color")
    .populate("size");

  return res.status(200).json(cart || []);
});

const removeProductFromCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { cartItemId } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(cartItemId);

  const deleted = await Cart.deleteOne({ userId: _id, _id: cartItemId });
  res.json(deleted);
});

const updateProductQuantityFromCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { cartItemId, newQuantity } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(cartItemId);

  const cartItem = await Cart.findOne({ userId: _id, _id: cartItemId });
  if (!cartItem) {
    res.status(404);
    throw new Error("Cart item not found");
  }

  cartItem.quantity = Math.max(1, Number(newQuantity || 1));
  await cartItem.save();

  res.json(cartItem);
});

const emptyCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  const deleted = await Cart.deleteMany({ userId: _id });
  res.json(deleted);
});

// ============================
// ✅ RECEIPT HTML
// ============================
const generateReceiptHtml = (order, shippingInfo = {}, orderItems = [], totalPrice = 0, paymentInfo = {}) => {
  const escapeHtml = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatUGX = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "UGX 0";
    return `UGX ${num.toLocaleString()}`;
  };

  const getProductTitle = (prod) => {
    if (!prod) return "Product";
    if (typeof prod === "object") return prod.title || prod.name || "Product";
    return "Product";
  };

  const getProductDescription = (prod) => {
    if (!prod || typeof prod !== "object") return "";
    return prod.description || "";
  };

  const getProductImageUrl = (prod) => {
    if (!prod || typeof prod !== "object") return "";
    const imgs = Array.isArray(prod.images) ? prod.images : [];
    if (!imgs.length) return "";
    const first = imgs[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return first.url || "";
    return "";
  };

  const getVariantLabel = (v) => {
    if (!v) return "";
    if (typeof v === "object") return v.title || v.name || v.label || "";
    return String(v);
  };

  const orderId = escapeHtml(order?._id || "");
  const createdAt = order?.createdAt ? new Date(order.createdAt) : new Date();
  const orderDate = escapeHtml(createdAt.toLocaleDateString());

  const firstName = escapeHtml(shippingInfo?.firstName || "");
  const lastName = escapeHtml(shippingInfo?.lastName || "");
  const phone = escapeHtml(shippingInfo?.phone || "");
  const email = escapeHtml(shippingInfo?.email || "");
  const address = escapeHtml(shippingInfo?.address || "Not provided");
  const region = escapeHtml(shippingInfo?.region || "Not provided");
  const subRegion = escapeHtml(shippingInfo?.subRegion || "");

  const paymentMethod = escapeHtml(paymentInfo?.paymentMethod || "Not specified");
  const payStatus = escapeHtml(paymentInfo?.status || "Pending");

  const paypalOrderID = paymentInfo?.paypalOrderID ? escapeHtml(paymentInfo.paypalOrderID) : "";
  const paypalCaptureID = paymentInfo?.paypalCaptureID ? escapeHtml(paymentInfo.paypalCaptureID) : "";
  const paypalPayerID = paymentInfo?.paypalPayerID ? escapeHtml(paymentInfo.paypalPayerID) : "";

  const itemsHtml = (Array.isArray(orderItems) ? orderItems : [])
    .map((item) => {
      const prod = item?.product;

      const title = escapeHtml(getProductTitle(prod));
      const desc = escapeHtml(getProductDescription(prod) || "No description available");
      const imgUrl = getProductImageUrl(prod);

      const qty = escapeHtml(item?.quantity ?? 1);
      const price = formatUGX(item?.unitPrice);

      const sizeLabel = escapeHtml(getVariantLabel(item?.size) || "Not specified");
      const colorLabel = escapeHtml(getVariantLabel(item?.color) || "Not specified");
      const instruction = escapeHtml(item?.instruction || "None");

      const uploadedFiles = Array.isArray(item?.uploadedFiles) ? item.uploadedFiles : [];

      const filesHtml = uploadedFiles.length
        ? `<div style="margin-top:8px;">
             <strong>Artwork Files:</strong>
             <ul style="margin:6px 0 0 18px; padding:0;">
               ${uploadedFiles
                 .map((f) => {
                   const name = escapeHtml(
                     f?.fileName ||
                       f?.original_filename ||
                       f?.originalFilename ||
                       (f?.public_id ? String(f.public_id).split("/").pop() : "file")
                   );
                   const url = f?.url ? escapeHtml(f.url) : "";
                   return `<li style="margin:4px 0;">
                             ${url ? `<a href="${url}" target="_blank" rel="noreferrer">${name}</a>` : name}
                           </li>`;
                 })
                 .join("")}
             </ul>
           </div>`
        : "";

      return `
        <li style="margin: 16px 0; padding: 14px; border: 1px solid #e9e9e9; border-radius: 10px;">
          <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
            <div style="width: 120px; height: 120px; border: 1px solid #f0f0f0; border-radius: 10px; overflow:hidden; background:#fff; display:flex; align-items:center; justify-content:center;">
              ${
                imgUrl
                  ? `<img src="${escapeHtml(imgUrl)}" alt="${title}" style="width:100%; height:100%; object-fit:contain;" />`
                  : `<div style="font-size:12px; color:#999; padding:8px; text-align:center;">No image</div>`
              }
            </div>

            <div style="flex:1; min-width:220px;">
              <div style="font-size:16px; font-weight:700; margin-bottom:6px;">${title}</div>
              <div style="font-size:13px; color:#444; margin-bottom:10px;">${desc}</div>

              <div style="font-size:13px; color:#222; line-height:1.7;">
                <div><strong>Quantity:</strong> ${qty}</div>
                <div><strong>Unit Price:</strong> ${escapeHtml(price)}</div>
                <div><strong>Size:</strong> ${sizeLabel}</div>
                <div><strong>Color:</strong> ${colorLabel}</div>
                <div><strong>Instructions:</strong> ${instruction}</div>
              </div>

              ${filesHtml}
            </div>
          </div>
        </li>
      `;
    })
    .join("");

  const paypalExtra =
    String(paymentInfo?.paymentMethod || "").toLowerCase() === "paypal"
      ? `
          <div style="margin-top:10px; font-size:13px; color:#222; line-height:1.7;">
            ${paypalOrderID ? `<div><strong>PayPal Order ID:</strong> ${paypalOrderID}</div>` : ""}
            ${paypalCaptureID ? `<div><strong>PayPal Capture ID:</strong> ${paypalCaptureID}</div>` : ""}
            ${paypalPayerID ? `<div><strong>PayPal Payer ID:</strong> ${paypalPayerID}</div>` : ""}
          </div>
        `
      : "";

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color:#111; max-width: 720px; margin: 0 auto; padding: 18px;">
      <div style="padding: 18px; border: 1px solid #eee; border-radius: 12px;">
        <h1 style="margin: 0 0 10px; font-size: 22px;">Order Receipt</h1>

        <div style="font-size: 13px; color:#444; line-height:1.7;">
          <div><strong>Order Number:</strong> ${orderId}</div>
          <div><strong>Order Date:</strong> ${orderDate}</div>
        </div>

        <hr style="border:none; border-top:1px solid #eee; margin: 14px 0;" />

        <h3 style="margin: 0 0 8px; font-size: 16px;">Shipping Information</h3>
        <div style="font-size: 13px; color:#222; line-height:1.7;">
          <div><strong>Name:</strong> ${firstName} ${lastName}</div>
          ${phone ? `<div><strong>Phone:</strong> ${phone}</div>` : ""}
          ${email ? `<div><strong>Email:</strong> ${email}</div>` : ""}
          <div><strong>Address:</strong> ${address}, ${region}${subRegion ? `, ${subRegion}` : ""}</div>
        </div>

        <hr style="border:none; border-top:1px solid #eee; margin: 14px 0;" />

        <h3 style="margin: 0 0 8px; font-size: 16px;">Order Items</h3>
        <ul style="list-style:none; margin: 0; padding: 0;">
          ${itemsHtml || `<li style="color:#777; font-size:13px;">No items found.</li>`}
        </ul>

        <hr style="border:none; border-top:1px solid #eee; margin: 14px 0;" />

        <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="font-size: 13px; color:#222; line-height:1.7;">
            <div><strong>Payment Method:</strong> ${paymentMethod}</div>
            <div><strong>Payment Status:</strong> ${payStatus}</div>
            ${paypalExtra}
          </div>

          <div style="text-align:right; min-width: 220px;">
            <div style="font-size: 13px; color:#666;">Total</div>
            <div style="font-size: 20px; font-weight: 800;">${escapeHtml(formatUGX(totalPrice))}</div>
          </div>
        </div>

        <div style="margin-top: 16px; font-size: 12px; color:#777;">
          Thank you for your purchase.
        </div>
      </div>
    </div>
  `;
};

// ============================
// ✅ CREATE ORDER (AUTH ONLY - NO GUEST)
// ============================
const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingInfo,
    orderItems,
    itemsTotal,
    shippingPrice,
    setupFeeTotal,
    totalPrice,
    totalPriceAfterDiscount,
    paymentInfo,
    note,
  } = req.body;

  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  if (!shippingInfo) return res.status(400).json({ message: "shippingInfo is required" });
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res.status(400).json({ message: "orderItems must be a non-empty array" });
  }
  if (!paymentInfo || typeof paymentInfo !== "object") {
    return res.status(400).json({ message: "paymentInfo is required" });
  }

  const safeShipping = {
    firstName: String(shippingInfo.firstName || "").trim(),
    lastName: String(shippingInfo.lastName || "").trim(),
    phone: normalizeMobile(shippingInfo.phone || "") || String(shippingInfo.phone || "").trim(),
    email: normalizeEmail(shippingInfo.email || ""),
    address: String(shippingInfo.address || "").trim(),
    region: String(shippingInfo.region || "").trim(),
    subRegion: String(shippingInfo.subRegion || "").trim(),
  };

  if (!safeShipping.firstName || !safeShipping.lastName || !safeShipping.address || !safeShipping.region) {
    return res.status(400).json({ message: "shippingInfo is missing required fields" });
  }
  if (!safeShipping.phone) return res.status(400).json({ message: "shippingInfo.phone is required" });
  if (!safeShipping.email) return res.status(400).json({ message: "shippingInfo.email is required" });

  const paymentMethod = String(paymentInfo.paymentMethod || "").trim();
  if (!paymentMethod) return res.status(400).json({ message: "Payment method is required" });

  const allowedPayments = ["cashOnDelivery", "mobileMoney", "card", "paypal"];
  if (!allowedPayments.includes(paymentMethod)) {
    return res.status(400).json({ message: "Invalid payment method" });
  }

  const paypalOrderID = paymentInfo.paypalOrderID || paymentInfo.orderID || paymentInfo.orderId || null;
  const paypalCaptureID = paymentInfo.paypalCaptureID || paymentInfo.captureID || paymentInfo.captureId || null;
  const paypalPayerID = paymentInfo.paypalPayerID || paymentInfo.payerID || paymentInfo.payerId || null;

  const safePaymentInfo = {
    paymentMethod,
    status: paymentInfo.status || "Pending",
    paypalOrderID: null,
    paypalCaptureID: null,
    paypalPayerID: null,
    provider: paymentInfo.provider || null,
    transactionId: paymentInfo.transactionId || null,
  };

  if (paymentMethod === "paypal") {
    if (!paypalOrderID) return res.status(400).json({ message: "PayPal Order ID is required" });
    safePaymentInfo.paypalOrderID = String(paypalOrderID);
    safePaymentInfo.paypalCaptureID = paypalCaptureID ? String(paypalCaptureID) : null;
    safePaymentInfo.paypalPayerID = paypalPayerID ? String(paypalPayerID) : null;
  }

  let computedItemsTotal = 0;

  const safeOrderItems = orderItems.map((it, idx) => {
    const prodId = toId(it.product);
    if (!prodId) {
      const e = new Error(`orderItems[${idx}].product is required`);
      e.statusCode = 400;
      throw e;
    }
    validateMongoDbId(prodId);

    const qty = Math.max(1, Number(it.quantity || 1));
    const unitPrice = requirePositiveMoney(it.unitPrice, `orderItems[${idx}].unitPrice`);
    computedItemsTotal += unitPrice * qty;

    const colorId = toId(it.color);
    const sizeId = toId(it.size);
    if (colorId) validateMongoDbId(colorId);
    if (sizeId) validateMongoDbId(sizeId);

    return {
      product: prodId,
      color: colorId || null,
      size: sizeId || null,
      uploadedFiles: Array.isArray(it.uploadedFiles) ? it.uploadedFiles : [],
      quantity: qty,
      unitPrice,
      printUnitPrice: toMoney(it.printUnitPrice || 0),
      printPricingTitle: it.printPricingTitle || null,
      printSide: it.printSide || "",
      instruction: it.instruction ?? null,
    };
  });

  const safeShippingPrice = Math.max(0, toMoney(shippingPrice));
  const safeSetupFeeTotal = Math.max(0, toMoney(setupFeeTotal));
  const computedTotalPrice = computedItemsTotal + safeShippingPrice + safeSetupFeeTotal;

  if (itemsTotal != null && Math.abs(toMoney(itemsTotal) - computedItemsTotal) > 0.01) {
    return res.status(400).json({ message: "itemsTotal mismatch" });
  }
  if (totalPrice != null && Math.abs(toMoney(totalPrice) - computedTotalPrice) > 0.01) {
    return res.status(400).json({ message: "totalPrice mismatch" });
  }

  const safeTotalPriceAfterDiscount =
    totalPriceAfterDiscount != null ? Math.max(0, toMoney(totalPriceAfterDiscount)) : computedTotalPrice;

  const order = await Order.create({
    user: userId,
    guestInfo: null,
    shippingInfo: safeShipping,
    orderItems: safeOrderItems,

    itemsTotal: computedItemsTotal,
    shippingPrice: safeShippingPrice,
    setupFeeTotal: safeSetupFeeTotal,

    totalPrice: computedTotalPrice,
    totalPriceAfterDiscount: safeTotalPriceAfterDiscount,

    paymentInfo: safePaymentInfo,
    note: note ?? null,
  });

  const receiptTo = (await User.findById(userId).select("email"))?.email || null;

  if (receiptTo) {
    try {
      const fullOrder = await Order.findById(order._id)
        .populate("orderItems.product")
        .populate("orderItems.color")
        .populate("orderItems.size");

      const receiptHtml = generateReceiptHtml(
        fullOrder || order,
        safeShipping,
        (fullOrder || order)?.orderItems || safeOrderItems,
        computedTotalPrice,
        safePaymentInfo
      );

      await sendEmail({
        to: receiptTo,
        subject: "Your Order Receipt",
        text: "Thank you for your purchase! Please find your receipt below.",
        html: receiptHtml,
      });
    } catch (e) {
      console.error("Receipt email failed:", e);
    }
  }

  return res.status(201).json({ success: true, order });
});

// ============================
// ✅ ORDERS
// ============================
const getMyOrders = asyncHandler(async (req, res) => {
  const { _id } = req.user;

  const orders = await Order.find({ user: _id })
    .populate("user")
    .populate("orderItems.product")
    .populate("orderItems.color")
    .populate("orderItems.size");

  res.json({ orders });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find().populate("user");
  res.json({ orders });
});

const getSingleOrders = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const order = await Order.findOne({ _id: id })
    .populate("orderItems.product")
    .populate("orderItems.color")
    .populate("orderItems.size")
    .populate("user");

  res.json({ order });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  validateMongoDbId(id);

  const nextStatus = String(status || "").trim();
  if (!nextStatus) return res.status(400).json({ message: "status is required" });
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return res.status(400).json({ message: "Invalid order status" });
  }

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  const current = String(order.orderStatus || "Ordered");
  if (current === "Delivered") {
    return res.status(400).json({ message: "Delivered orders cannot be updated" });
  }

  const isCancelled =
    Boolean(order.isCancelled) || String(order.orderStatus || "").toLowerCase() === "cancelled";
  if (isCancelled && nextStatus !== "Cancelled") {
    return res.status(400).json({ message: "Cancelled orders cannot be re-opened" });
  }

  if (nextStatus === "Cancelled") {
    order.isCancelled = true;
    order.cancelledAt = order.cancelledAt || new Date();
    order.cancelledBy = order.cancelledBy || "admin";
  }

  order.orderStatus = nextStatus;
  await order.save();

  res.json({ order });
});

// ============================
// ✅ ANALYTICS
// ============================
const getMonthWiseOrderIncome = asyncHandler(async (req, res) => {
  let d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);

  const data = await Order.aggregate([
    { $match: { createdAt: { $gte: d, $lte: new Date() } } },
    {
      $project: {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        totalPriceAfterDiscount: 1,
      },
    },
    {
      $group: {
        _id: { year: "$year", month: "$month" },
        amount: { $sum: "$totalPriceAfterDiscount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
    {
      $project: {
        _id: 0,
        month: "$_id.month",
        year: "$_id.year",
        amount: 1,
        count: 1,
      },
    },
  ]);

  res.json(data);
});

const getYearlyTotalOrders = asyncHandler(async (req, res) => {
  let d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11);

  const startDate = new Date(d);

  const data = await Order.aggregate([
    { $match: { createdAt: { $lte: new Date(), $gte: startDate } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: "$totalPriceAfterDiscount" },
      },
    },
  ]);

  res.json(data);
});

// ============================
// ✅ OTP
// ============================
const OTP_STORE = new Map();
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendVerificationCodeCtrl = asyncHandler(async (req, res) => {
  const { identity, type } = req.body;

  if (!identity || !type) {
    return res.status(400).json({ message: "identity and type are required" });
  }

  const normalized = type === "email" ? normalizeEmail(identity) : normalizeMobile(identity);
  if (!normalized) return res.status(400).json({ message: "identity is not valid" });

  const code = generateOtp();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  const key = `${type}:${normalized}`;
  OTP_STORE.set(key, { code, expiresAt });

  if (type === "email") {
    await sendEmail({
      to: normalized,
      subject: "Kupto verification code",
      text: `Your Kupto verification code is ${code}. It expires in 10 minutes.`,
      html: `<p>Your Kupto verification code is <b>${code}</b>. It expires in 10 minutes.</p>`,
    });

    return res.status(200).json({
      success: true,
      message: "Verification code sent to email",
      type,
      normalized,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Verification code generated. (SMS sending not configured yet)",
    type,
    normalized,
    // ⚠️ remove in production
    debugCode: code,
  });
});

const verifyCodeCtrl = asyncHandler(async (req, res) => {
  const { identity, type, code } = req.body;

  if (!identity || !type || !code) {
    return res.status(400).json({ message: "identity, type and code are required" });
  }

  const normalized = type === "email" ? normalizeEmail(identity) : normalizeMobile(identity);
  if (!normalized) return res.status(400).json({ message: "identity is not valid" });

  const key = `${type}:${normalized}`;
  const saved = OTP_STORE.get(key);

  if (!saved) return res.status(400).json({ message: "Code not found. Please resend." });
  if (Date.now() > saved.expiresAt) {
    OTP_STORE.delete(key);
    return res.status(400).json({ message: "Code expired. Please resend." });
  }
  if (String(code).trim() !== saved.code) return res.status(400).json({ message: "Invalid code" });

  OTP_STORE.delete(key);

  return res.status(200).json({
    success: true,
    message: "Code verified",
    next: "signup",
    type,
    normalized,
  });
});

// ============================
// ✅ PASSWORD RESET VIA EMAIL CODE
// ============================
const PW_RESET_STORE = new Map();
const generateResetCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const okGenericForgotResponse = (res) =>
  res.status(200).json({
    success: true,
    message: "If an account exists for this email, a verification code was sent.",
  });

const forgotPasswordCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400);
    throw new Error("email is required");
  }

  const user = await User.findOne({ email });
  if (!user) return okGenericForgotResponse(res);

  const code = generateResetCode();
  const expiresAt = Date.now() + 10 * 60 * 1000;

  PW_RESET_STORE.set(email, { code, expiresAt });

  await sendEmail({
    to: email,
    subject: "Kupto password reset code",
    text: `Your Kupto password reset code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your Kupto password reset code is <b>${code}</b>. It expires in 10 minutes.</p>`,
  });

  return okGenericForgotResponse(res);
});

const verifyResetCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();

  if (!email || !code) {
    res.status(400);
    throw new Error("email and code are required");
  }

  const saved = PW_RESET_STORE.get(email);

  if (!saved) {
    res.status(400);
    throw new Error("Code not found. Please request a new code.");
  }

  if (Date.now() > saved.expiresAt) {
    PW_RESET_STORE.delete(email);
    res.status(400);
    throw new Error("Code expired. Please request a new code.");
  }

  if (code !== saved.code) {
    res.status(400);
    throw new Error("Invalid code");
  }

  return res.status(200).json({ success: true, message: "Code verified", email });
});

const resetPasswordWithCode = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  const password = req.body?.password;

  if (!email || !code || !password) {
    res.status(400);
    throw new Error("email, code and password are required");
  }

  const saved = PW_RESET_STORE.get(email);

  if (!saved) {
    res.status(400);
    throw new Error("Code not found. Please request a new code.");
  }

  if (Date.now() > saved.expiresAt) {
    PW_RESET_STORE.delete(email);
    res.status(400);
    throw new Error("Code expired. Please request a new code.");
  }

  if (code !== saved.code) {
    res.status(400);
    throw new Error("Invalid code");
  }

  PW_RESET_STORE.delete(email);

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    res.status(400);
    throw new Error("Unable to reset password. Please request a new code.");
  }

  user.password = password;
  await user.save();

  return res.status(200).json({ success: true, message: "Password reset successful" });
});

// ============================
// ✅ CANCEL MY ORDER (AUTH)
// ============================
const cancelMyOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const userId = req.user?._id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  validateMongoDbId(id);

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (!order.user || String(order.user) !== String(userId)) {
    res.status(403);
    throw new Error("Not allowed to cancel this order");
  }

  if (order.isCancelled || String(order.orderStatus).toLowerCase() === "cancelled") {
    return res.status(200).json({ success: true, message: "Order already cancelled", order });
  }

  const status = String(order.orderStatus || "Ordered").toLowerCase();
  if (status !== "ordered") {
    res.status(400);
    throw new Error("This order can no longer be cancelled");
  }

  order.isCancelled = true;
  order.cancelledAt = new Date();
  order.cancelReason = reason ? String(reason).trim().slice(0, 300) : null;
  order.cancelledBy = "user";
  order.orderStatus = "Cancelled";

  await order.save();

  return res.status(200).json({ success: true, message: "Order cancelled successfully", order });
});

// ============================
// ✅ CANCEL ORDER (ADMIN)
// ============================
const cancelOrderAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  validateMongoDbId(id);

  const order = await Order.findById(id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (order.isCancelled || String(order.orderStatus).toLowerCase() === "cancelled") {
    return res.status(200).json({ success: true, message: "Order already cancelled", order });
  }

  const status = String(order.orderStatus || "Ordered").toLowerCase();
  if (status === "delivered") {
    res.status(400);
    throw new Error("Delivered orders cannot be cancelled");
  }

  order.isCancelled = true;
  order.cancelledAt = new Date();
  order.cancelReason = reason ? String(reason).trim().slice(0, 300) : null;
  order.cancelledBy = "admin";
  order.orderStatus = "Cancelled";

  await order.save();

  return res.status(200).json({ success: true, message: "Order cancelled", order });
});

// ============================
// ✅ EXPORTS
// ============================
module.exports = {
  // auth
  registerUserCtrl,
  loginUserCtrl,
  googleLoginCtrl,
  identifyUserCtrl,
  loginAdmin,
  handleRefreshToken,
  logout,

  // user
  getallUser,
  getaUser,
  deleteaUser,
  updatedUser,
  blockUser,
  unblockUser,
  updatePassword,

  // password reset
  forgotPasswordCode,
  verifyResetCode,
  resetPasswordWithCode,

  saveAddress,

  // wishlist
  getWishlist,
  removeProductFromWishlist,

  // cart
  userCart,
  getUserCart,
  removeProductFromCart,
  updateProductQuantityFromCart,
  emptyCart,

  // orders
  createOrder,
  getMyOrders,
  getAllOrders,
  getSingleOrders,
  updateOrder,

  // analytics
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,

  // otp
  sendVerificationCodeCtrl,
  verifyCodeCtrl,

  // cancellation
  cancelMyOrder,
  cancelOrderAdmin,
};