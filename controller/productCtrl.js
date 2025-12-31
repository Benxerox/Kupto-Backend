// controllers/productCtrl.js
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbid");
const User = require("../models/userModel");

/* =========================================
   Helpers
========================================= */
const toNumberOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN; // keep NaN to detect invalid numbers
};

const makeSlug = (title) =>
  slugify(String(title || "").trim(), { lower: true, strict: true });

/* =========================================
   CREATE PRODUCT
   - generate slug
   - validate discountedPrice <= price
   - optional: guard slug uniqueness
========================================= */
const createProduct = asyncHandler(async (req, res) => {
  try {
    if (req.body.title) req.body.slug = makeSlug(req.body.title);

    // ✅ validate discountedPrice vs price (create)
    const priceNum = toNumberOrNull(req.body.price);
    const discountNum = toNumberOrNull(req.body.discountedPrice);

    if (Number.isNaN(priceNum)) {
      return res.status(400).json({ message: "Invalid price" });
    }
    if (Number.isNaN(discountNum)) {
      return res.status(400).json({ message: "Invalid discounted price" });
    }
    if (discountNum !== null && discountNum > priceNum) {
      return res
        .status(400)
        .json({ message: "Discounted price cannot be higher than price" });
    }

    // ✅ optional: slug uniqueness check (helps give nicer error than Mongo duplicate key)
    if (req.body.slug) {
      const exists = await Product.findOne({ slug: req.body.slug }).select("_id");
      if (exists) {
        return res.status(400).json({ message: "Slug already exists. Change product title." });
      }
    }

    const newProduct = await Product.create(req.body);
    return res.status(201).json({ newProduct });
  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(400).json({
      message: error?.message || "Product creation failed",
      error: error?.message,
    });
  }
});

/* =========================================
   UPDATE PRODUCT
   - generate slug
   - validate discountedPrice <= price correctly (even if only one is sent)
   - reject NaN
   - guard slug uniqueness
========================================= */
const updateProduct = asyncHandler(async (req, res) => {
  const id = req.params.id;
  validateMongoDbId(id);

  try {
    if (req.body.title) req.body.slug = makeSlug(req.body.title);

    // ✅ fetch existing so we can compare against current values
    const existing = await Product.findById(id).select("price discountedPrice slug");
    if (!existing) return res.status(404).json({ message: "Product not found" });

    // ✅ slug uniqueness if changing
    if (req.body.slug && req.body.slug !== existing.slug) {
      const exists = await Product.findOne({ slug: req.body.slug, _id: { $ne: id } }).select("_id");
      if (exists) {
        return res.status(400).json({ message: "Slug already exists. Change product title." });
      }
    }

    // nextPrice: body.price if provided else existing.price
    const nextPrice =
      req.body.price !== undefined && req.body.price !== null && req.body.price !== ""
        ? toNumberOrNull(req.body.price)
        : Number(existing.price);

    if (Number.isNaN(nextPrice)) {
      return res.status(400).json({ message: "Invalid price" });
    }

    // nextDiscount:
    // - if discountedPrice NOT sent -> keep existing discountedPrice
    // - if sent as "" or null -> set null
    // - else convert to number
    let nextDiscount = existing.discountedPrice ?? null;

    if (req.body.discountedPrice !== undefined) {
      if (req.body.discountedPrice === "" || req.body.discountedPrice === null) {
        nextDiscount = null;
      } else {
        nextDiscount = toNumberOrNull(req.body.discountedPrice);
      }
    }

    if (Number.isNaN(nextDiscount)) {
      return res.status(400).json({ message: "Invalid discounted price" });
    }

    if (nextDiscount !== null && nextDiscount > nextPrice) {
      return res
        .status(400)
        .json({ message: "Discounted price cannot be higher than price" });
    }

    const updated = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
      context: "query",
    });

    return res.json({ message: "Product updated successfully", data: updated });
  } catch (error) {
    console.error(`Error updating product with ID ${id}:`, error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/* =========================================
   DELETE PRODUCT
========================================= */
const deleteProduct = asyncHandler(async (req, res) => {
  const id = req.params.id;
  validateMongoDbId(id);

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json({ message: "Product deleted successfully", data: deletedProduct });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/* =========================================
   GET A PRODUCT (supports id OR slug)
========================================= */
const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const isMongoId = mongoose.Types.ObjectId.isValid(id);
  const query = isMongoId ? { _id: id } : { slug: id };

  const findProduct = await Product.findOne(query)
    .populate("color")
    .populate("size")
    .populate("category");

  if (!findProduct) return res.status(404).json({ message: "Product not found" });

  return res.json(findProduct);
});

/* =========================================
   GET ALL PRODUCTS
========================================= */
const getAllProduct = asyncHandler(async (req, res) => {
  // filtering
  const queryObj = { ...req.query };
  const excludeFields = ["page", "sort", "limit", "fields"];
  excludeFields.forEach((el) => delete queryObj[el]);

  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

  let query = Product.find(JSON.parse(queryStr));

  // sorting
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // limiting fields
  if (req.query.fields) {
    const fields = req.query.fields.split(",").join(" ");
    query = query.select(fields);
  } else {
    query = query.select("-__v");
  }

  // pagination
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 100);
  const skip = (page - 1) * limit;

  query = query.skip(skip).limit(limit);

  if (req.query.page) {
    const productCount = await Product.countDocuments();
    if (skip >= productCount) throw new Error("This Page does not exist");
  }

  const product = await query;
  return res.json(product);
});

/* =========================================
   ADD TO WISHLIST
========================================= */
const addToWhishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.body;

  try {
    const user = await User.findById(_id);
    const alreadyAdded = user.wishlist.find((id) => id.toString() === prodId);

    const updatedUser = alreadyAdded
      ? await User.findByIdAndUpdate(_id, { $pull: { wishlist: prodId } }, { new: true })
      : await User.findByIdAndUpdate(_id, { $push: { wishlist: prodId } }, { new: true });

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: "Error adding to wishlist", error: error.message });
  }
});

/* =========================================
   RATING
========================================= */
const rating = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { star, prodId, comment } = req.body;

  const product = await Product.findById(prodId);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const alreadyRated = product.ratings.find(
    (r) => r.postedBy.toString() === _id.toString()
  );

  if (alreadyRated) {
    await Product.updateOne(
      { "ratings.postedBy": _id, _id: prodId },
      { $set: { "ratings.$.star": star, "ratings.$.comment": comment } }
    );
  } else {
    await Product.findByIdAndUpdate(
      prodId,
      {
        $push: {
          ratings: { star, comment, postedBy: _id },
        },
      },
      { new: true }
    );
  }

  const getallratings = await Product.findById(prodId);
  const totalRating = getallratings.ratings.length;
  const ratingsum = getallratings.ratings
    .map((item) => item.star)
    .reduce((prev, curr) => prev + curr, 0);

  const actualRating = Math.round(ratingsum / totalRating);

  const finalproduct = await Product.findByIdAndUpdate(
    prodId,
    { totalrating: actualRating },
    { new: true }
  );

  return res.json(finalproduct);
});

module.exports = {
  createProduct,
  getaProduct,
  getAllProduct,
  updateProduct,
  deleteProduct,
  addToWhishlist,
  rating,
};
