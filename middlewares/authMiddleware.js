<<<<<<< HEAD
/*const User = require ('../models/userModel');
=======
const User = require ('../models/userModel');
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");


const authMiddleware = asyncHandler(async(req, res, next)=>{
  let token;
  if (req?.headers?.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(" ")[1];
    try {
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded?.id);
        req.user = user;
        next();
      }
    } catch (error) {
      throw new Erorr ('Not Authorized token expired, Please Login again');
    }
  } else {
    throw new Error ('There is no token attached to header');
  }
});
const isAdmin = asyncHandler(async(req, res, next)=> {
  const {email} = req.user;
  const adminUser = await User.findOne({email});
  if (adminUser.role !== "admin") {
    throw new Error('You are not an admin')
  } else {
    next();
  }
});

module.exports = { authMiddleware, isAdmin };

<<<<<<< HEAD
*/
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");

const authMiddleware = asyncHandler(async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization || req.headers.Authorization;

  // 1️⃣ Extract token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
=======
/*
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');

const authMiddleware = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
  }

  if (!token) {
    res.status(401);
<<<<<<< HEAD
    throw new Error("Not authorized, no token attached to header");
  }

  try {
    // 2️⃣ Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Load user, remove password field
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      res.status(401);
      throw new Error("Not authorized, user not found");
    }

    // 4️⃣ Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("JWT verify error:", error.message);
    res.status(401);
    throw new Error("Not authorized, token invalid or expired. Please log in again.");
=======
    throw new Error('Not authorized, no token');
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
  }
});

const isAdmin = asyncHandler(async (req, res, next) => {
<<<<<<< HEAD
  // assuming your User model has a .role field with values like "user", "admin"
  if (req.user && req.user.role === "admin") {
    return next();
  }

  res.status(403);
  throw new Error("You are not an admin");
});

module.exports = { authMiddleware, isAdmin };
=======
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
});

module.exports = { authMiddleware, isAdmin };
*/
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
