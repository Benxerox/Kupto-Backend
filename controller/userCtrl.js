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

  
const loginUserCtrl = asyncHandler(async(req, res)=>{
  const {email,password} = req.body;
  //check if user exists or not
  const findUser = await User.findOne({email});
  if (findUser && await findUser.isPasswordMatched(password)) {
    const refreshToken = await generateRefreshToken(findUser?._id);
    const updateuser = await User.findByIdAndUpdate(findUser.id, {
      refreshToken:refreshToken
    }, 
    { new: true });
    res.cookie('refreshToken',refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      id: findUser?._id,
      firstname: findUser?.firstname,
      lastname: findUser.lastname,
      email: findUser?.email,
      mobile: findUser?.mobile,
      token: generateToken(findUser?._id)
    });
  } else {
    throw new Error('Invalid Credentials');
  }
});

//admin login
const loginAdmin = asyncHandler(async(req, res)=>{
  const {email,password} = req.body;
  //check if user exists or not
  const findAdmin = await User.findOne({email});
  if (findAdmin.role !== 'admin') throw new Error('Not Authorised');
  if (findAdmin && (await findAdmin.isPasswordMatched(password))) {
    const refreshToken = await generateRefreshToken(findAdmin?._id);
    const updateuser = await User.findByIdAndUpdate(findAdmin.id, {
      refreshToken:refreshToken
    }, 
    { new: true });
    res.cookie('refreshToken',refreshToken, {
      httpOnly: true,
      maxAge: 72 * 60 * 60 * 1000,
    });
    res.json({
      id: findAdmin?._id,
      firstname: findAdmin?.firstname,
      lastname: findAdmin.lastname,
      email: findAdmin?.email,
      mobile: findAdmin?.mobile,
      token: generateToken(findAdmin?._id)
    });
  } else {
    throw new Error('Invalid Credentials');
  }
});

//handle refresh token
const handleRefreshToken = asyncHandler(async(req, res)=>{
  const cookie = req.cookies;
  if(!cookie?.refreshToken) throw new Error('No Refresh Token in Cookies');
  const refreshToken = cookie.refreshToken;
  const user = await User.findOne({ refreshToken });
  if(!user) throw new Error('No Refresh Token Present in db or not matched');
  jwt.verify(refreshToken, process.env.JWT_SECRET, (err, decoded)=>{
    if (err || user.id !== decoded.id) {
      throw new Error('There is something wrong with refresh token')
    }
    const accessToken = generateToken(user?._id);
    res.json({accessToken});
  });
});

//Logout functionality
const logout = asyncHandler(async (req, res) => {
  const cookie = req.cookies;
  if (!cookie?.refreshToken) throw new Error('No Refresh Token in Cookies');

  const refreshToken = cookie.refreshToken;

  // Find the user by refreshToken
  const user = await User.findOne({ refreshToken });

  if (!user) {
    // If user not found, clear the refreshToken cookie and respond with 204
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true
    });
    return res.sendStatus(204); // No Content
  }

  // Update user to clear refreshToken
  await User.findOneAndUpdate({ refreshToken }, { refreshToken: '' });

  // Clear refreshToken cookie and respond with 204
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: true
  });
  res.sendStatus(204); // No Content
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
/*
const forgotPasswordToken = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) throw new Error('User not found with this email')

  try {
    const token = await User.createPasswordResetToken();
    await user.save();

    const resetURL = `Hi, please follow this link to reset your password. This link is valid for 10 minutes from now: <a href='http://localhost:3000/reset-password/${token}'>Click Here</a>`;
    const data = {
      to: email,
      text: 'Hey User',
      subject: 'Forgot Password Link',
      htm: resetURL,
    };

    sendEmail(data);
    res.json({ message: 'Password reset link sent', token });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
});*/
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
  const { productId, color, quantity, size, price, uploadedFiles } = req.body;
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
      uploadedFiles  // Add uploaded files to the cart
    }).save();

    res.json(newCart);
  } catch (error) {
    throw new Error(error);
  }
});
/*
const userCart = asyncHandler(async (req, res) => {
  const {productId, color, quantity, size, price} = req.body;
  const {_id} = req.user;
  validateMongoDbId(_id);
  try {
    let newCart = await new Cart({
      userId:_id,
      productId,
      color,
      size,
      price,
      quantity
    }).save();
    res.json(newCart);
  } catch (error) {
    throw new Error(error);
  }
});*/
/*
const getUserCart = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  validateMongoDbId(_id);

  try {
    console.log('User ID:', _id);
    const cart = await Cart.find({ userId: _id })
      .populate('productId')
      .populate('color')
      .populate('size');

    console.log('Fetched cart:', cart); // Log the fetched cart data
    res.json(cart);
  } catch (error) {
    console.error('Error while fetching cart:', error.message); // Log error message
    res.status(500).json({ message: 'Server error' });
  }
});
*/
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
      return res.status(404).json({ message: 'Cart is empty' });
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



/*const createOrder = asyncHandler(async(req, res)=>{
  const {shippingInfo, orderItems, totalPrice, totalPriceAfterDiscount, paymentInfo} = req.body;
  const {_id} = req.user;
  try {
    const order = await Order.create({
      shippingInfo, orderItems, totalPrice, totalPriceAfterDiscount, paymentInfo, user:_id
    })
    res.json({
      order,
      success: true
    })
  } catch (error) {
    throw new Error(error);
  }
})*/

const createOrder = asyncHandler(async (req, res) => {
  const { shippingInfo, orderItems, totalPrice, totalPriceAfterDiscount, paymentInfo } = req.body;
  const { _id } = req.user;

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

    // Respond with the created order and success flag
    res.json({
      order,
      success: true,
    });
  } catch (error) {
    // Log the error and send a 500 status code
    console.error('Error creating order:', error.message);
    res.status(500).json({ message: error.message });
  }
});

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
      .populate('orderItems.product').populate('orderItems.color').populate('orderItems.size') // Ensure this matches the field name in your schema
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