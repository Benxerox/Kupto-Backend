// controllers/productCtrl.js
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
  return Number.isFinite(n) ? n : NaN;
};

const pickNested = (obj, path) => {
  try {
    return path.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
  } catch {
    return undefined;
  }
};

const isPresent = (v) => v !== null && v !== undefined;

/**
 * Validate pricing rules for:
 * - price / discountedPrice / discountMinQty
 * - bulkDiscount.minQty / bulkDiscount.price
 * - minOrder / maxOrder
 *
 * NOTE:
 * discountedPrice = SALE unit price (must be < price)
 */
const validatePricingPayload = ({ body, existing }) => {
  // -----------------------
  // price
  // -----------------------
  const nextPrice =
    body.price !== undefined && body.price !== null && body.price !== ""
      ? toNumberOrNull(body.price)
      : existing
      ? Number(existing.price)
      : toNumberOrNull(body.price);

  if (Number.isNaN(nextPrice)) return { ok: false, message: "Invalid price" };
  if (nextPrice < 0) return { ok: false, message: "Price must be >= 0" };

  // -----------------------
  // discountedPrice (SALE price)
  // -----------------------
  let nextDiscounted = existing?.discountedPrice ?? null;

  if (body.discountedPrice !== undefined) {
    if (body.discountedPrice === "" || body.discountedPrice === null) nextDiscounted = null;
    else nextDiscounted = toNumberOrNull(body.discountedPrice);
  }

  if (Number.isNaN(nextDiscounted)) return { ok: false, message: "Invalid discountedPrice" };
  if (nextDiscounted !== null && nextDiscounted < 0)
    return { ok: false, message: "discountedPrice must be >= 0" };

  // ✅ SALE price rule: discountedPrice must be < price
  if (nextDiscounted !== null && !(Number(nextDiscounted) < Number(nextPrice))) {
    return { ok: false, message: "discountedPrice must be less than price" };
  }

  // -----------------------
  // discountMinQty (threshold for discountedPrice)
  // -----------------------
  let nextDiscountMinQty = existing?.discountMinQty ?? null;

  if (body.discountMinQty !== undefined) {
    if (body.discountMinQty === "" || body.discountMinQty === null) nextDiscountMinQty = null;
    else nextDiscountMinQty = toNumberOrNull(body.discountMinQty);
  }

  if (Number.isNaN(nextDiscountMinQty)) return { ok: false, message: "Invalid discountMinQty" };
  if (nextDiscountMinQty !== null && nextDiscountMinQty < 1)
    return { ok: false, message: "discountMinQty must be >= 1" };

  // ✅ if discountMinQty is set, discountedPrice MUST be set
  if (nextDiscountMinQty !== null && (nextDiscounted === null || nextDiscounted === undefined)) {
    return { ok: false, message: "discountMinQty requires discountedPrice to be set" };
  }

  // -----------------------
  // bulkDiscount (minQty + price together)
  // -----------------------
  const bdMinRaw =
    pickNested(body, "bulkDiscount.minQty") !== undefined
      ? pickNested(body, "bulkDiscount.minQty")
      : existing
      ? existing?.bulkDiscount?.minQty
      : undefined;

  const bdPriceRaw =
    pickNested(body, "bulkDiscount.price") !== undefined
      ? pickNested(body, "bulkDiscount.price")
      : existing
      ? existing?.bulkDiscount?.price
      : undefined;

  const bdMin =
    bdMinRaw === "" || bdMinRaw === undefined || bdMinRaw === null ? null : toNumberOrNull(bdMinRaw);
  const bdPrice =
    bdPriceRaw === "" || bdPriceRaw === undefined || bdPriceRaw === null
      ? null
      : toNumberOrNull(bdPriceRaw);

  if (Number.isNaN(bdMin)) return { ok: false, message: "Invalid bulkDiscount.minQty" };
  if (Number.isNaN(bdPrice)) return { ok: false, message: "Invalid bulkDiscount.price" };

  const hasBdMin = isPresent(bdMin);
  const hasBdPrice = isPresent(bdPrice);

  // if one is set, require the other
  if (hasBdMin !== hasBdPrice) {
    return { ok: false, message: "bulkDiscount requires BOTH minQty and price" };
  }

  if (hasBdMin && hasBdPrice) {
    if (bdMin < 1) return { ok: false, message: "bulkDiscount.minQty must be >= 1" };
    if (bdPrice < 0) return { ok: false, message: "bulkDiscount.price must be >= 0" };
    if (Number(bdPrice) > Number(nextPrice)) {
      return { ok: false, message: "bulkDiscount.price must be <= price" };
    }
  }

  // -----------------------
  // minOrder / maxOrder
  // -----------------------
  const nextMinOrder =
    body.minOrder !== undefined
      ? body.minOrder === "" || body.minOrder === null
        ? null
        : toNumberOrNull(body.minOrder)
      : existing?.minOrder ?? null;

  const nextMaxOrder =
    body.maxOrder !== undefined
      ? body.maxOrder === "" || body.maxOrder === null
        ? null
        : toNumberOrNull(body.maxOrder)
      : existing?.maxOrder ?? null;

  if (Number.isNaN(nextMinOrder)) return { ok: false, message: "Invalid minOrder" };
  if (Number.isNaN(nextMaxOrder)) return { ok: false, message: "Invalid maxOrder" };

  if (nextMinOrder !== null && nextMinOrder < 1) return { ok: false, message: "minOrder must be >= 1" };
  if (nextMaxOrder !== null && nextMaxOrder < 1) return { ok: false, message: "maxOrder must be >= 1" };

  if (nextMinOrder !== null && nextMaxOrder !== null && nextMaxOrder < nextMinOrder) {
    return { ok: false, message: "maxOrder must be greater than or equal to minOrder" };
  }

  return {
    ok: true,
    nextPrice,
    nextDiscounted,
    nextDiscountMinQty,
    bdMin,
    bdPrice,
    nextMinOrder,
    nextMaxOrder,
  };
};

/* =========================================
   CREATE PRODUCT
========================================= */
const createProduct = asyncHandler(async (req, res) => {
  try {
    if (req.body.title) req.body.slug = slugify(req.body.title.trim());

    const check = validatePricingPayload({ body: req.body, existing: null });
    if (!check.ok) return res.status(400).json({ message: check.message });

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
========================================= */
const updateProduct = asyncHandler(async (req, res) => {
  const id = req.params.id;
  validateMongoDbId(id);

  try {
    if (req.body.title) req.body.slug = slugify(req.body.title.trim());

    const existing = await Product.findById(id).select(
      "price discountedPrice discountMinQty minOrder maxOrder bulkDiscount"
    );
    if (!existing) return res.status(404).json({ message: "Product not found" });

    const check = validatePricingPayload({ body: req.body, existing });
    if (!check.ok) return res.status(400).json({ message: check.message });

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
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    return res.json({ message: "Product deleted successfully", data: deletedProduct });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/* =========================================
   GET A PRODUCT
========================================= */
const getaProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const findProduct = await Product.findById(id)
    .populate("color")
    .populate("size")
    .populate("category")
    .populate({ path: "variantImages.color", model: "Color" }); // ✅ IMPORTANT

  return res.json({ data: findProduct }); // ✅ consistent

});

/* =========================================
   GET ALL PRODUCTS
========================================= */
const getAllProduct = asyncHandler(async (req, res) => {
  // 1) clone query params
  const queryObj = { ...req.query };

  // 2) remove special params (same as your code)
  const excludeFields = ["page", "sort", "limit", "fields"];
  excludeFields.forEach((el) => delete queryObj[el]);

  // 3) build filter + support gte/gt/lte/lt
  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

  const filter = JSON.parse(queryStr);

  // 4) sorting (same behavior as your code)
  const sortBy = req.query.sort ? req.query.sort.split(",").join(" ") : "-createdAt";

  // 5) field selection (same behavior as your code)
  const selectFields = req.query.fields ? req.query.fields.split(",").join(" ") : "-__v";

  // 6) pagination (keep your defaults, but safer)
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Number(req.query.limit || 100));
  const skip = (page - 1) * limit;

  // ✅ IMPORTANT FIX: count documents using the SAME filter (not all products)
  const total = await Product.countDocuments(filter);
  const pages = Math.ceil(total / limit);

  // ✅ IMPORTANT FIX: validate page against FILTERED total
  if (req.query.page && skip >= total) {
    return res.status(400).json({ message: "This Page does not exist" });
  }

  // 7) run query
  const data = await Product.find(filter)
    .sort(sortBy)
    .select(selectFields)
    .skip(skip)
    .limit(limit);

  // 8) return data + meta (so frontend/admin can load ALL products reliably)
  return res.json({
    total,
    page,
    limit,
    pages,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
    data,
  });
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
   ✅ store average as decimal (1 decimal)
========================================= */
const rating = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { star, prodId, comment } = req.body;

  const product = await Product.findById(prodId);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const alreadyRated = product.ratings.find((r) => r.postedBy.toString() === _id.toString());

  if (alreadyRated) {
    await Product.updateOne(
      { "ratings.postedBy": _id, _id: prodId },
      { $set: { "ratings.$.star": star, "ratings.$.comment": comment } }
    );
  } else {
    await Product.findByIdAndUpdate(
      prodId,
      { $push: { ratings: { star, comment, postedBy: _id } } },
      { new: true }
    );
  }

  const refreshed = await Product.findById(prodId);
  const total = refreshed.ratings.length;
  const sum = refreshed.ratings.reduce((acc, r) => acc + (Number(r.star) || 0), 0);

  const avg = total ? sum / total : 0;
  const avg1 = Math.round(avg * 10) / 10;

  const finalproduct = await Product.findByIdAndUpdate(
    prodId,
    { totalrating: avg1 },
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
