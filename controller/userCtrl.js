const User = require('../models/userModel'); // Adjust the path as necessary

const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const Coupon = require('../models/couponModel');
const Order = require('../models/order.model');
const uniqid = require('uniqid');
const asyncHandler = require('express-async-handler');
const { generateToken } = require('../config/jwtToken');
const validateMongoDbId = require('../utils/validateMongodbid');
const { generateRefreshToken } = require('../config/refreshToken');
const jwt = require('jsonwebtoken');
const sendEmail = require('./emailCtrl');
const crypto = require('crypto');
const mongoose = require('mongoose');




const createUser = asyncHandler(async (req, res) => {
  const email = req.body.email;
  const findUser = await User.findOne({email:email});
  if (!findUser) {
    //create a new User
    const newUser = await User.create(req.body);
    res.json(newUser);
  }
  else {
    throw new Error('User Already Exists');
  }
});

  
const loginUserCtrl = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if the user exists
  const findUser = await User.findOne({ email });
  if (!findUser) {
    throw new Error('Invalid Credentials');
  }

  // Check if password matches
  const passwordMatch = await findUser.isPasswordMatched(password);
  if (!passwordMatch) {
    throw new Error('Invalid Credentials');
  }

  // Generate refresh token and update the user
  const refreshToken = generateRefreshToken(findUser._id);
  findUser.refreshToken = refreshToken;  // Directly update the refreshToken in the user model
  await findUser.save();

  // Set refresh token in cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // Use secure cookies in production
    maxAge: 72 * 60 * 60 * 1000,  // 72 hours
  });

  // Send response with user data and access token
  res.json({
    id: findUser._id,
    firstname: findUser.firstname,
    lastname: findUser.lastname,
    email: findUser.email,
    mobile: findUser.mobile,
    token: generateToken(findUser._id),  // Access token
  });
});

//admin login
const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Check if the admin exists
  const findAdmin = await User.findOne({ email });
  if (!findAdmin || findAdmin.role !== 'admin') {
    throw new Error('Not Authorized');
  }

  // Check if password matches
  const passwordMatch = await findAdmin.isPasswordMatched(password);
  if (!passwordMatch) {
    throw new Error('Invalid Credentials');
  }

  // Generate refresh token and update the admin user
  const refreshToken = generateRefreshToken(findAdmin._id);
  findAdmin.refreshToken = refreshToken;  // Directly update the refreshToken in the admin model
  await findAdmin.save();

  // Set refresh token in cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',  // Use secure cookies in production
    maxAge: 72 * 60 * 60 * 1000,  // 72 hours
  });

  // Send response with admin data and access token
  res.json({
    id: findAdmin._id,
    firstname: findAdmin.firstname,
    lastname: findAdmin.lastname,
    email: findAdmin.email,
    mobile: findAdmin.mobile,
    token: generateToken(findAdmin._id),  // Access token
  });
});

//handle refresh token
const handleRefreshToken = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) {
    throw new Error('No Refresh Token in Cookies');
  }

  const refreshToken = cookie.refreshToken;
  // Find the user by the refreshToken
  const user = await User.findOne({ refreshToken });
  if (!user) {
    throw new Error('No Refresh Token Present in DB or not matched');
  }

  try {
    // Verify the refresh token
    const decoded = await jwt.verify(refreshToken, process.env.JWT_SECRET); // Use async/await with jwt.verify
    if (user.id !== decoded.id) {
      throw new Error('There is something wrong with the refresh token');
    }

    // Generate new access token
    const accessToken = generateToken(user._id);

    // Send the new access token as response
    res.json({ accessToken });
  } catch (err) {
    // Handle any error during JWT verification
    throw new Error('Invalid or expired refresh token');
  }
});

//Logout functionality
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error('No Refresh Token in Cookies');

  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });

  if (!user) {
   
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true
    });
    return res.sendStatus(204);
  }

  await User.findOneAndUpdate({ refreshToken }, { refreshToken: '' });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true
  });
  res.sendStatus(204);
});

// Update a user

const updatedUser = asyncHandler(async(req, res)=> {
  const { _id } = req.user;
  validateMongoDbId(_id);
  try {
    const updatedUser = await User.findByIdAndUpdate(_id, {
      firstname:req?.body?.firstname,
      lastname: req?.body?.lastname,
      email: req?.body?.email,
      mobile: req?.body?.mobile
    },
  {
    new: true,
  });
  res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

//save user Address
const saveAddress = asyncHandler(async(req, res, next)=>{
  const {_id} = req.user;
  validateMongoDbId(_id);
  try {
    const updatedUser = await User.findByIdAndUpdate(_id, {
      address:req?.body?.address,
    },
  {
    new: true,
  });
  res.json(updatedUser);
  } catch (error) {
    throw new Error(error);
  }
});

//Get all users

const getallUser = asyncHandler (async(req, res)=> {
  try {
    const getUsers = await User.find();
    res.json(getUsers);
  }
  catch (error) {
    throw new Error(error)
  }
});


//Get a single user

const getaUser = asyncHandler (async(req, res)=>{
  const {id} = req.params;
  validateMongoDbId(id);
  try {
    const getaUser = await User.findById(id);
    res.json({
      getaUser,
    });
  } catch(error) {
    throw new Error(error);
  }
});

//Delete a single user

const deleteaUser = asyncHandler (async(req, res)=>{
  const {id} = req.params;
  validateMongoDbId(id);
  try {
    const deleteaUser = await User.findByIdAndDelete(id);
    res.json({
      deleteaUser,
    });
  } catch(error) {
    throw new Error(error);
  }
});

const blockUser = asyncHandler(async(req, res)=>{
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const block = await User.findByIdAndUpdate(
      id, 
    {
      isBlocked: true,
    },{
      new: true,
    }
  );
  res.json(block);
  } catch (error) {
    throw new Error(error);
  }
});

const unblockUser = asyncHandler(async(req, res)=>{
  const { id } = req.params;
  validateMongoDbId(id);
  try {
    const unblock = await User.findByIdAndUpdate(
      id, 
    {
      isBlocked: false,
    },{
      new: true,
    });
    res.json({
      message: "User UnBlocked",
    });
  } catch (error) {
    throw new Error(error);
  }
});

const updatePassword = asyncHandler(async(req, res)=> {
  const {_id} = req.user;
  const { password } = req.body;
  validateMongoDbId(_id);
  const user = await User.findById(_id);
  if(password) {
    user.password = password;
    const updatedPassword = await user.save();
    res.json(updatedPassword);
  } else {
    res.json(user);
  }
});

const forgotPasswordToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error('User not found with this email');
  }

  try {
    // Call the instance method on the user instance
    const token = await user.createPasswordResetToken();
    await user.save();

    const resetURL = `Hi, please follow this link to reset your password. This link is valid for 10 minutes from now: <a href='http://www.kupto.co/reset-password/${token}'>Click Here</a>`;
    const data = {
      to: email,
      text: 'Hey User',
      subject: 'Forgot Password Link',
      html: resetURL,  // Correct key for HTML content
    };

    await sendEmail(data);
    res.json({ message: 'Password reset link sent', token });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
});

const resetPassword = asyncHandler(async(req, res)=>{
  const {password} = req.body;
  const {token} = req.params;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: {$gt: Date.now()},
  });
  if (!user) throw new Error('Token Expired, Please try again later');
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json(user);
});


const getWishlist = asyncHandler(async(req, res)=>{
  const { _id } = req.user;
  try {
    const findUser = await User.findById(_id).populate('wishlist');
    res.json(findUser);
  } catch (error) {
    throw new Error(error);
  }
});

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

  try {
    // ✅ 1) find existing FIRST
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

      // keep latest values
      if (price != null) existing.price = Number(price);
      if (variantImage != null) existing.variantImage = variantImage;

      existing.instruction = instruction ?? existing.instruction ?? null;

      existing.printSide = printSide ?? existing.printSide ?? "";
      existing.printUnitPrice =
        printUnitPrice != null
          ? Number(printUnitPrice)
          : Number(existing.printUnitPrice || 0);

      existing.printKey = printKey ?? existing.printKey ?? "";
      existing.printPricingTitle = printPricingTitle ?? existing.printPricingTitle ?? "";

      existing.preparePriceOnce =
        preparePriceOnce != null
          ? Number(preparePriceOnce)
          : Number(existing.preparePriceOnce || 0);

      existing.preparePriceApplied =
        preparePriceApplied != null
          ? Boolean(preparePriceApplied)
          : Boolean(existing.preparePriceApplied);

      existing.printDiscountMinQty =
        printDiscountMinQty != null ? Number(printDiscountMinQty) : existing.printDiscountMinQty ?? null;

      // append files if provided
      if (Array.isArray(uploadedFiles) && uploadedFiles.length) {
        existing.uploadedFiles = [...(existing.uploadedFiles || []), ...uploadedFiles];
      }

      await existing.save();
      return res.json(existing);
    }

    // ✅ 2) otherwise create new
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
      printDiscountMinQty: printDiscountMinQty != null ? Number(printDiscountMinQty) : null,
    });

    return res.json(newCart);
  } catch (error) {
    throw new Error(error);
  }
});

 





const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    const cart = await Cart.find({ userId: _id })
      .populate('productId') // Populate product details
      .populate('color')     // Populate color details
      .populate('size');     // Populate size details

    // Check if the cart is empty
    if (cart.length === 0) {
      // Return an empty array with a 200 status
      return res.status(200).json([]);
    }

    res.json(cart);
  } catch (error) {
    console.error('Error while fetching cart:', error.message); // Log error message
    res.status(500).json({ message: 'Server error' });
  }
});

const removeProductFromCart = asyncHandler(async(req, res)=>{
  const {_id} = req.user;
  const {cartItemId} = req.params;
  
  validateMongoDbId(_id);
  try {
    const deleteProductFromCart = await Cart.deleteOne({userId: _id, _id: cartItemId})
    res.json(deleteProductFromCart);
  } catch (error) {
    throw new Error(error)
  }
});

const updateProductQuantityFromCart = asyncHandler(async(req, res)=>{
  const {_id} = req.user;
  const {cartItemId, newQuantity} = req.params;
  validateMongoDbId(_id);
  try {
    const cartItem = await Cart.findOne({userId: _id, _id: cartItemId});
    cartItem.quantity = newQuantity;
    cartItem.save()
    res.json(cartItem);
  } catch (error) {
    throw new Error(error)
  }
});

const emptyCart = asyncHandler(async(req, res)=>{
  const {_id} = req.user;
  validateMongoDbId(_id);
  try {
    const deleteCart = await Cart.deleteMany({userId: _id})
    res.json(deleteCart);
  } catch (error) {
    throw new Error(error)
  }
});



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
    return "Product"; // product is likely an id string
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
  const address = escapeHtml(shippingInfo?.address || "Not provided");
  const region = escapeHtml(shippingInfo?.region || "Not provided");
  const subRegion = escapeHtml(shippingInfo?.subRegion || "Not provided");

  const paymentMethod = escapeHtml(paymentInfo?.paymentMethod || "Not specified");
  const payStatus = escapeHtml(paymentInfo?.status || "Pending");
  const paypalOrderID = paymentInfo?.paypalOrderID ? escapeHtml(paymentInfo.paypalOrderID) : "";
  const paypalPaymentID = paymentInfo?.paypalPaymentID ? escapeHtml(paymentInfo.paypalPaymentID) : "";
  const paypalPayerID = paymentInfo?.paypalPayerID ? escapeHtml(paymentInfo.paypalPayerID) : "";

  const itemsHtml = (Array.isArray(orderItems) ? orderItems : []).map((item) => {
    const prod = item?.product;

    const title = escapeHtml(getProductTitle(prod));
    const desc = escapeHtml(getProductDescription(prod) || "No description available");
    const imgUrl = getProductImageUrl(prod);

    const qty = escapeHtml(item?.quantity ?? 1);
    const price = formatUGX(item?.price);

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
                 // If you don't want clickable links in email, remove <a>
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
  }).join("");

  const paypalExtra =
    paymentMethod.toLowerCase() === "paypal"
      ? `
        <div style="margin-top:10px; font-size:13px; color:#222; line-height:1.7;">
          ${paypalOrderID ? `<div><strong>PayPal Order ID:</strong> ${paypalOrderID}</div>` : ""}
          ${paypalPaymentID ? `<div><strong>PayPal Payment ID:</strong> ${paypalPaymentID}</div>` : ""}
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
          <div><strong>Address:</strong> ${address}, ${region}, ${subRegion}</div>
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




const createOrder = asyncHandler(async (req, res) => {
  const {
    shippingInfo,
    orderItems,
    totalPrice,
    totalPriceAfterDiscount,
    paymentInfo,
  } = req.body;

  const { _id } = req.user;

  // ✅ basic validation
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return res.status(400).json({ message: "orderItems must be a non-empty array" });
  }

  if (!shippingInfo) {
    return res.status(400).json({ message: "shippingInfo is required" });
  }

  // ✅ default instruction if missing
  const safeOrderItems = orderItems.map((item) => ({
    ...item,
    instruction: item?.instruction ? item.instruction : null,
  }));

  // ✅ payment validation
  if (!paymentInfo || typeof paymentInfo !== "object") {
    return res.status(400).json({ message: "paymentInfo is required" });
  }

  const methodRaw = paymentInfo.paymentMethod;
  const paymentMethod = String(methodRaw || "").trim();

  if (!paymentMethod) {
    return res.status(400).json({ message: "Payment method is required" });
  }

  // ✅ normalize PayPal fields
  // (Keep the names you already use, but also accept common aliases safely)
  const paypalOrderID =
    paymentInfo.paypalOrderID ||
    paymentInfo.paypal_order_id ||
    paymentInfo.orderID ||
    paymentInfo.orderId ||
    null;

  const paypalPaymentID =
    paymentInfo.paypalPaymentID ||
    paymentInfo.paypal_payment_id ||
    paymentInfo.paymentID ||
    paymentInfo.paymentId ||
    null;

  const paypalPayerID =
    paymentInfo.paypalPayerID ||
    paymentInfo.payerID ||
    paymentInfo.payerId ||
    null;

  // ✅ Build "safePaymentInfo" (store only what makes sense per method)
  const safePaymentInfo = {
    paymentMethod,
    // optional generic fields you might have:
    status: paymentInfo.status || "Pending",
    // PayPal fields (only for PayPal)
    paypalOrderID: null,
    paypalPaymentID: null,
    paypalPayerID: null,
  };

  const isPayPal = paymentMethod.toLowerCase() === "paypal";

  if (isPayPal) {
    // ✅ PayPal REQUIRED fields
    if (!paypalOrderID) {
      return res.status(400).json({ message: "PayPal Order ID is required" });
    }

    // paymentID is sometimes not available immediately depending on your flow.
    // If your frontend always has it, keep it required. Otherwise allow it.
    // ✅ Here: require at least one of paymentID or payerID to reduce failures.
    if (!paypalPaymentID && !paypalPayerID) {
      return res.status(400).json({
        message: "PayPal Payment ID (or Payer ID) is required",
      });
    }

    safePaymentInfo.paypalOrderID = String(paypalOrderID);
    safePaymentInfo.paypalPaymentID = paypalPaymentID ? String(paypalPaymentID) : null;
    safePaymentInfo.paypalPayerID = paypalPayerID ? String(paypalPayerID) : null;

    // If your verification route confirms payment, you can set this to "Paid"
    // safePaymentInfo.status = "Paid";
  } else {
    // ✅ Non-PayPal: ensure we do NOT store PayPal IDs
    safePaymentInfo.paypalOrderID = null;
    safePaymentInfo.paypalPaymentID = null;
    safePaymentInfo.paypalPayerID = null;
  }

  try {
    // ✅ Create order
    const order = await Order.create({
      shippingInfo,
      orderItems: safeOrderItems,
      totalPrice,
      totalPriceAfterDiscount,
      paymentInfo: safePaymentInfo,
      user: _id,
    });

    // ✅ (optional) clear cart after successful order
    // await Cart.deleteMany({ userId: _id });

    const user = await User.findById(_id).select("email firstname lastname");
    const userEmail = user?.email;

    // ✅ send receipt email only if email exists
    if (userEmail) {
      const receiptHtml = generateReceiptHtml(
        order,
        shippingInfo,
        safeOrderItems,
        totalPrice,
        safePaymentInfo
      );

      const emailData = {
        to: userEmail,
        subject: "Your Order Receipt",
        text: "Thank you for your purchase! Please find your receipt below.",
        html: receiptHtml,
      };

      try {
        await sendEmail(emailData);
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don’t fail the order if email fails
      }
    }

    return res.status(201).json({
      order,
      success: true,
      message: userEmail
        ? "Order created and receipt sent successfully."
        : "Order created successfully.",
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({
      message: "Failed to create order",
      error: error?.message || "Unknown error",
    });
  }
});



/*
const createOrder = asyncHandler(async (req, res) => {
  const { shippingInfo, orderItems, totalPrice, totalPriceAfterDiscount, paymentInfo } = req.body;
  const { _id } = req.user;

  orderItems.forEach(item => {
    // Ensure the instruction is included if needed
    if (!item.instruction) {
      item.instruction = null;  // or provide a default instruction
    }
  });

  // Check if paymentInfo and paymentMethod are provided
  if (!paymentInfo || !paymentInfo.paymentMethod) {
    console.error('Error: Payment method is required');
    return res.status(400).json({ message: 'Payment method is required' });
  }

  // Validate PayPal-specific fields if PayPal is selected
  if (paymentInfo.paymentMethod === 'PayPal') {
    if (!paymentInfo.paypalOrderID || !paymentInfo.paypalPaymentID) {
      console.error('Error: PayPal Order ID and Payment ID are required for PayPal payments');
      return res.status(400).json({ message: 'PayPal Order ID and Payment ID are required for PayPal payments' });
    }
  } else {
    // Ensure that PayPal specific fields are set to null if not using PayPal
    paymentInfo.paypalOrderID = null;
    paymentInfo.paypalPaymentID = null;
  }

  try {
    // Create the order
    const order = await Order.create({
      shippingInfo,
      orderItems,
      totalPrice,
      totalPriceAfterDiscount,
      paymentInfo,
      user: _id,
    });
    res.json({
      order,
      success: true,
    });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: error.message });
  }
});
*/

const getMyOrders = asyncHandler(async(req, res)=>{
  const {_id} = req.user;
  try {
    const orders = await Order.find({user:_id}).populate('user')
    .populate('orderItems.product')
    .populate('orderItems.color')
    .populate('orderItems.size')
   
   

    res.json({
      orders
    })
    
  } catch (error) {
    throw new Error(error);
  }
});

const getAllOrders = asyncHandler(async(req, res)=>{
  
  try {
    const orders = await Order.find().populate('user');
    res.json({
      orders
    })
    
  } catch (error) {
    throw new Error(error);
  }
});

const getSingleOrders = asyncHandler(async(req, res)=>{
  const {id} = req.params;
  try {
    const order = await Order.findOne({ _id: id })
      .populate('orderItems.product')
      .populate('orderItems.color')
      .populate('orderItems.size')
      .populate('user');
    res.json({ order });
    
  } catch (error) {
    throw new Error(error);
  }
});
/*
const updateOrder = asyncHandler(async(req, res)=>{
  const {id} = req.params;
  try {
    const order = await Order.findById(id);
    order.orderStatus = req.body.status;
    await order.save();
    res.json({ order });
    
  } catch (error) {
    throw new Error(error);
  }
});*/

const updateOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const order = await Order.findById(id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    await Order.updateOne({ _id: id }, { $set: { orderStatus: status } });

    const updatedOrder = await Order.findById(id);

    res.json({ order: updatedOrder });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const getMonthWiseOrderIncome = asyncHandler(async (req, res) => {
  let d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 11); // Go back 11 months to get the start date

  const data = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: d,
          $lte: new Date(),
        },
      },
    },
    {
      $project: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        totalPriceAfterDiscount: 1,
      },
    },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
        },
        amount: { $sum: '$totalPriceAfterDiscount' },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 },
    },
    {
      $project: {
        _id: 0,
        month: '$_id.month',
        year: '$_id.year',
        amount: 1,
        count: 1,
      },
    },
  ]);

  res.json(data);
});




const getYearlyTotalOrders = asyncHandler(async(req, res)=>{
  let monthNames = [ 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December' ];
  let d = new Date();
  let endDate = '';
  d.setDate(1)
  for (let index = 0; index < 11; index++) {
    d.setMonth(d.getMonth()-1)
    endDate = monthNames[d.getMonth()] + '' + d.getFullYear()
    
  }
  const data = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $lte: new Date(),
          $gte: new Date(endDate)
        }
      }
    }, {
      $group: {
        _id: null,
         count: {$sum: 1},
         amount: {$sum: "$totalPriceAfterDiscount"}
      }
    }
  ])
  res.json(data);
})

// remove product from wishlist
const removeProductFromWishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.params;

  validateMongoDbId(_id);
  validateMongoDbId(prodId);

  try {
    const user = await User.findByIdAndUpdate(
      _id,
      { $pull: { wishlist: prodId } }, // ✅ remove from array
      { new: true }
    ).populate("wishlist");

    res.json(user);
  } catch (error) {
    throw new Error(error);
  }
});





module.exports = { 
  createUser,
  loginUserCtrl, 
  getallUser, 
  getaUser, 
  deleteaUser, 
  updatedUser,
  blockUser,
  unblockUser,
  handleRefreshToken,
  logout,
  updatePassword,
  forgotPasswordToken,
  resetPassword,
  loginAdmin,
  getWishlist,
  saveAddress,
  userCart,
  getUserCart,
  createOrder,
  removeProductFromCart,
  removeProductFromWishlist,
  updateProductQuantityFromCart,
  getMyOrders,
  emptyCart,
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,
  getAllOrders,
  getSingleOrders,
  updateOrder,

};