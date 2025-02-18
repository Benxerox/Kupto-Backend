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

    const resetURL = `Hi, please follow this link to reset your password. This link is valid for 10 minutes from now: <a href='http://localhost:3000/reset-password/${token}'>Click Here</a>`;
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
  const { productId, color, quantity, size, price, uploadedFiles, instruction } = req.body;
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    // Create a new cart entry with the uploaded files
    let newCart = await new Cart({
      userId: _id,
      productId,
      color,
      size,
      price,
      quantity,
      uploadedFiles,
      instruction,
    }).save();

    res.json(newCart);
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

    // Fetch user email for sending the receipt
    const user = await User.findById(_id);
    const userEmail = user.email;

    // Create a receipt HTML content
    const receiptHtml = `
      <h1>Order Receipt</h1>
      <h3>Order Number: ${order._id}</h3>
      <h3>Shipping Information:</h3>
      <p>Address: ${shippingInfo.address}</p>
      <p>City: ${shippingInfo.city}</p>
      <p>Zip: ${shippingInfo.zip}</p>
      <h3>Order Items:</h3>
      <ul>
        ${orderItems.map(item => `
          <li>
            Product: ${item.product.name}<br>
            Quantity: ${item.quantity}<br>
            Price: ${item.price}<br>
            Size: ${item.size}<br>
            Color: ${item.color}<br>
            Instructions: ${item.instruction || 'None'}
          </li>
        `).join('')}
      </ul>
      <h3>Total Price: ${totalPrice}</h3>
      <h3>Payment Method: ${paymentInfo.paymentMethod}</h3>
      <h3>Order Date: ${order.createdAt}</h3>
    `;

    // Prepare email data
    const emailData = {
      to: userEmail,
      subject: 'Your Order Receipt',
      text: 'Thank you for your purchase! Please find your receipt below.',
      html: receiptHtml,
    };

    // Send email with the receipt
    await sendEmail(emailData);

    res.json({
      order,
      success: true,
      message: 'Order created and receipt sent successfully.',
    });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: error.message });
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
    .populate('orderItems.uploadedFiles')
   

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
  updateProductQuantityFromCart,
  getMyOrders,
  emptyCart,
  getMonthWiseOrderIncome,
  getYearlyTotalOrders,
  getAllOrders,
  getSingleOrders,
  updateOrder,
};