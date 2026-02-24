const Brand = require("../models/brandModel");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongodbid");

/**
 * CREATE BRAND
 * POST /api/brand
 */
const createBrand = asyncHandler(async (req, res) => {
  try {
    const { title, images, isActive } = req.body;

    if (!title || !title.trim()) {
      res.status(400);
      throw new Error("Brand name (title) is required");
    }

    const newBrand = await Brand.create({
      title: title.trim(),
      images: Array.isArray(images) ? images : [],
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    res.status(201).json(newBrand);
  } catch (error) {
    // Duplicate key error (unique: true)
    if (error?.code === 11000) {
      res.status(409);
      throw new Error("Brand name already exists");
    }
    throw new Error(error);
  }
});

/**
 * UPDATE BRAND
 * PUT /api/brand/:id
 */
const updateBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    // Ensure title trim if provided
    if (req.body?.title) req.body.title = req.body.title.trim();

    const updatedBrand = await Brand.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true, // ✅ important
    });

    if (!updatedBrand) {
      res.status(404);
      throw new Error("Brand not found");
    }

    res.json(updatedBrand);
  } catch (error) {
    if (error?.code === 11000) {
      res.status(409);
      throw new Error("Brand name already exists");
    }
    throw new Error(error);
  }
});

/**
 * DELETE BRAND
 * DELETE /api/brand/:id
 */
const deleteBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const deletedBrand = await Brand.findByIdAndDelete(id);

  if (!deletedBrand) {
    res.status(404);
    throw new Error("Brand not found");
  }

  res.json({ message: "Brand deleted successfully", id: deletedBrand._id });
});

/**
 * GET SINGLE BRAND
 * GET /api/brand/:id
 */
const getBrand = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const brand = await Brand.findById(id);

  if (!brand) {
    res.status(404);
    throw new Error("Brand not found");
  }

  res.json(brand);
});

/**
 * GET ALL BRANDS
 * GET /api/brand
 */
const getallBrand = asyncHandler(async (req, res) => {
  const brands = await Brand.find().sort({ createdAt: -1 });
  res.json(brands);
});

module.exports = {
  createBrand,
  updateBrand,
  deleteBrand,
  getBrand,
  getallBrand,
};