const Coupon = require('../models/couponModel');
const validateMongoDbid = require('../utils/validateMongodbid');
const asyncHandler = require('express-async-handler');

// Create a new coupon
const createCoupon = asyncHandler(async (req, res) => {
  try {
    const newCoupon = await Coupon.create(req.body);
    res.json(newCoupon);
    
  } catch (error) {
    throw new Error(error);
  }
});

// Get all coupons
const getAllCoupons = asyncHandler(async (req, res) => {
  try {
    const coupons = await Coupon.find();
    res.status(200).json(coupons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update an existing coupon
const updateCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params; // Ensure this is correct and present
  validateMongoDbid(id);

  try {
    const updatedCoupon = await Coupon.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true, // Ensure the update obeys the schema validation
    });

    if (!updatedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(200).json(updatedCoupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a coupon
const deleteCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params; // Ensure this is correct and present
  validateMongoDbid(id);

  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(id);
    if (!deletedCoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json(deletedCoupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a coupon
const getCoupon = asyncHandler(async (req, res) => {
  const { id } = req.params; // Ensure this is correct and present
  validateMongoDbid(id);

  try {
    const getACoupon = await Coupon.findById(id);
    if (!getACoupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json(getACoupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


<<<<<<< HEAD
module.exports = { createCoupon, getAllCoupons, updateCoupon, deleteCoupon, getCoupon, };
=======
module.exports = { createCoupon, getAllCoupons, updateCoupon, deleteCoupon, getCoupon, };
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
