const User = require ('../models/userModel');
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
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
});

const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(401);
    throw new Error('Not authorized as an admin');
  }
});

module.exports = { authMiddleware, isAdmin };
*/
