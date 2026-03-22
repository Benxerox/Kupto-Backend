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

const isPresent = (v) => v !== null && v !== undefined;

const normalizeObjectIdArray = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean).map((v) => String(v));
};

const normalizeImages = (images) => {
  if (!Array.isArray(images)) return [];
  return images
    .filter((img) => img && img.public_id && img.url)
    .map((img) => ({
      public_id: String(img.public_id).trim(),
      url: String(img.url).trim(),
    }));
};

const isValidationLikeError = (error) => {
  return (
    error?.name === "ValidationError" ||
    error?.name === "CastError" ||
    error?.name === "MongoServerError" ||
    error?.code === 11000
  );
};

/* =========================================
   Validate product-level pricing
========================================= */
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
  if (nextPrice === null) return { ok: false, message: "Price is required" };
  if (nextPrice < 0) return { ok: false, message: "Price must be >= 0" };

  // -----------------------
  // discountedPrice
  // -----------------------
  let nextDiscounted = existing?.discountedPrice ?? null;

  if (body.discountedPrice !== undefined) {
    if (body.discountedPrice === "" || body.discountedPrice === null) {
      nextDiscounted = null;
    } else {
      nextDiscounted = toNumberOrNull(body.discountedPrice);
    }
  }

  if (Number.isNaN(nextDiscounted)) {
    return { ok: false, message: "Invalid discountedPrice" };
  }

  if (nextDiscounted !== null && nextDiscounted < 0) {
    return { ok: false, message: "discountedPrice must be >= 0" };
  }

  if (nextDiscounted !== null && !(Number(nextDiscounted) < Number(nextPrice))) {
    return { ok: false, message: "discountedPrice must be less than price" };
  }

  // -----------------------
  // discountMinQty
  // -----------------------
  let nextDiscountMinQty = existing?.discountMinQty ?? null;

  if (body.discountMinQty !== undefined) {
    if (body.discountMinQty === "" || body.discountMinQty === null) {
      nextDiscountMinQty = null;
    } else {
      nextDiscountMinQty = toNumberOrNull(body.discountMinQty);
    }
  }

  if (Number.isNaN(nextDiscountMinQty)) {
    return { ok: false, message: "Invalid discountMinQty" };
  }

  if (nextDiscountMinQty !== null && nextDiscountMinQty < 1) {
    return { ok: false, message: "discountMinQty must be >= 1" };
  }

  if (nextDiscountMinQty !== null && (nextDiscounted === null || nextDiscounted === undefined)) {
    return { ok: false, message: "discountMinQty requires discountedPrice to be set" };
  }

  // -----------------------
  // bulkDiscount
  // -----------------------
  const bdMinRaw =
    body?.bulkDiscount?.minQty !== undefined
      ? body.bulkDiscount.minQty
      : existing
      ? existing?.bulkDiscount?.minQty
      : undefined;

  const bdPriceRaw =
    body?.bulkDiscount?.price !== undefined
      ? body.bulkDiscount.price
      : existing
      ? existing?.bulkDiscount?.price
      : undefined;

  const bdMin =
    bdMinRaw === "" || bdMinRaw === undefined || bdMinRaw === null
      ? null
      : toNumberOrNull(bdMinRaw);

  const bdPrice =
    bdPriceRaw === "" || bdPriceRaw === undefined || bdPriceRaw === null
      ? null
      : toNumberOrNull(bdPriceRaw);

  if (Number.isNaN(bdMin)) return { ok: false, message: "Invalid bulkDiscount.minQty" };
  if (Number.isNaN(bdPrice)) return { ok: false, message: "Invalid bulkDiscount.price" };

  const hasBdMin = isPresent(bdMin);
  const hasBdPrice = isPresent(bdPrice);

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
  // quantity
  // -----------------------
  const nextQuantity =
    body.quantity !== undefined
      ? body.quantity === "" || body.quantity === null
        ? null
        : toNumberOrNull(body.quantity)
      : existing?.quantity ?? null;

  if (Number.isNaN(nextQuantity)) return { ok: false, message: "Invalid quantity" };
  if (nextQuantity === null) return { ok: false, message: "Quantity is required" };
  if (nextQuantity < 0) return { ok: false, message: "Quantity must be >= 0" };

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

  if (nextMinOrder !== null && nextMinOrder < 1) {
    return { ok: false, message: "minOrder must be >= 1" };
  }

  if (nextMaxOrder !== null && nextMaxOrder < 1) {
    return { ok: false, message: "maxOrder must be >= 1" };
  }

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
    nextQuantity,
    nextMinOrder,
    nextMaxOrder,
  };
};

/* =========================================
   Validate colorVariants pricing
   No color-level bulkDiscount anymore
========================================= */
const validateColorVariantsPayload = ({ body, existing }) => {
  const incomingColors =
    body.color !== undefined
      ? normalizeObjectIdArray(body.color)
      : existing?.color
      ? existing.color.map((c) => String(c))
      : [];

  const colorVariants =
    body.colorVariants !== undefined
      ? Array.isArray(body.colorVariants)
        ? body.colorVariants
        : null
      : existing?.colorVariants || [];

  if (colorVariants === null) {
    return { ok: false, message: "colorVariants must be an array" };
  }

  const allowedColors = new Set(incomingColors);
  const seen = new Set();

  const effectiveBasePrice =
    body.price !== undefined && body.price !== null && body.price !== ""
      ? toNumberOrNull(body.price)
      : existing
      ? Number(existing.price)
      : null;

  if (effectiveBasePrice === null || Number.isNaN(effectiveBasePrice) || effectiveBasePrice < 0) {
    return { ok: false, message: "A valid base product price is required before color pricing." };
  }

  for (const variant of colorVariants) {
    if (!variant || !variant.color) {
      return { ok: false, message: "Each colorVariants item must include color." };
    }

    const colorId = String(variant.color);

    if (!allowedColors.has(colorId)) {
      return {
        ok: false,
        message: "Every colorVariants.color must exist in the product color array.",
      };
    }

    if (seen.has(colorId)) {
      return { ok: false, message: "Each color can only appear once in colorVariants." };
    }
    seen.add(colorId);

    const variantPrice =
      variant.price === "" || variant.price === undefined || variant.price === null
        ? Number(effectiveBasePrice)
        : toNumberOrNull(variant.price);

    if (Number.isNaN(variantPrice)) {
      return { ok: false, message: `Invalid color variant price for color ${colorId}` };
    }

    if (variantPrice < 0) {
      return { ok: false, message: `Color variant price must be >= 0 for color ${colorId}` };
    }

    const variantDiscounted =
      variant.discountedPrice === "" ||
      variant.discountedPrice === undefined ||
      variant.discountedPrice === null
        ? null
        : toNumberOrNull(variant.discountedPrice);

    if (Number.isNaN(variantDiscounted)) {
      return { ok: false, message: `Invalid color variant discountedPrice for color ${colorId}` };
    }

    if (variantDiscounted !== null && variantDiscounted < 0) {
      return {
        ok: false,
        message: `Color variant discountedPrice must be >= 0 for color ${colorId}`,
      };
    }

    if (variantDiscounted !== null && !(Number(variantDiscounted) < Number(variantPrice))) {
      return {
        ok: false,
        message: `Color variant discountedPrice must be less than price for color ${colorId}`,
      };
    }

    const variantDiscountMinQty =
      variant.discountMinQty === "" ||
      variant.discountMinQty === undefined ||
      variant.discountMinQty === null
        ? null
        : toNumberOrNull(variant.discountMinQty);

    if (Number.isNaN(variantDiscountMinQty)) {
      return { ok: false, message: `Invalid color variant discountMinQty for color ${colorId}` };
    }

    if (variantDiscountMinQty !== null && variantDiscountMinQty < 1) {
      return {
        ok: false,
        message: `Color variant discountMinQty must be >= 1 for color ${colorId}`,
      };
    }

    if (
      variantDiscountMinQty !== null &&
      (variantDiscounted === null || variantDiscounted === undefined)
    ) {
      return {
        ok: false,
        message: `Color variant discountMinQty requires discountedPrice for color ${colorId}`,
      };
    }

    const qty =
      variant.quantity === "" || variant.quantity === undefined || variant.quantity === null
        ? null
        : toNumberOrNull(variant.quantity);

    if (Number.isNaN(qty)) {
      return { ok: false, message: `Invalid color variant quantity for color ${colorId}` };
    }

    if (qty !== null && qty < 0) {
      return { ok: false, message: `Color variant quantity must be >= 0 for color ${colorId}` };
    }

    if (variant.images !== undefined && !Array.isArray(variant.images)) {
      return { ok: false, message: `Color variant images must be an array for color ${colorId}` };
    }
  }

  return { ok: true };
};

/* =========================================
   Normalize request body before save
========================================= */
const normalizeProductPayload = (body) => {
  const payload = { ...body };

  if (payload.title !== undefined && payload.title !== null) {
    payload.title = String(payload.title).trim();
    if (payload.title) {
      payload.slug = slugify(payload.title, {
        lower: true,
        strict: true,
        trim: true,
      });
    }
  }

  if (payload.brand !== undefined && payload.brand !== null) {
    payload.brand = String(payload.brand).trim();
  }

  if (payload.description !== undefined && payload.description !== null) {
    payload.description = String(payload.description);
  }

  if (payload.color !== undefined) {
    payload.color = normalizeObjectIdArray(payload.color);
  }

  if (payload.size !== undefined) {
    payload.size = normalizeObjectIdArray(payload.size);
  }

  if (payload.category !== undefined) {
    payload.category = normalizeObjectIdArray(payload.category);
  }

  if (payload.images !== undefined) {
    payload.images = normalizeImages(payload.images);
  }

  if (payload.tags !== undefined) {
    payload.tags = Array.isArray(payload.tags)
      ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
  }

  if (payload.isPrintable !== undefined) {
    payload.isPrintable =
      payload.isPrintable === true ||
      payload.isPrintable === "true" ||
      payload.isPrintable === 1 ||
      payload.isPrintable === "1";
  }

  if (payload.printingPrice !== undefined) {
    payload.printingPrice =
      payload.printingPrice === "" || payload.printingPrice === null
        ? null
        : String(payload.printingPrice);
  }

  if (payload.status !== undefined && payload.status !== null) {
    payload.status = String(payload.status).trim();
  }

  if (payload.colorVariants !== undefined && Array.isArray(payload.colorVariants)) {
    payload.colorVariants = payload.colorVariants
      .filter((v) => v && v.color)
      .map((v) => ({
        color: String(v.color),
        price: v.price === "" || v.price === undefined || v.price === null ? null : v.price,
        discountedPrice:
          v.discountedPrice === "" || v.discountedPrice === undefined || v.discountedPrice === null
            ? null
            : v.discountedPrice,
        discountMinQty:
          v.discountMinQty === "" || v.discountMinQty === undefined || v.discountMinQty === null
            ? null
            : v.discountMinQty,
        quantity:
          v.quantity === "" || v.quantity === undefined || v.quantity === null ? null : v.quantity,
        images: normalizeImages(v.images),
      }));
  }

  if (payload.bulkDiscount !== undefined) {
    payload.bulkDiscount = {
      minQty:
        payload.bulkDiscount?.minQty === "" ||
        payload.bulkDiscount?.minQty === undefined ||
        payload.bulkDiscount?.minQty === null
          ? null
          : payload.bulkDiscount.minQty,
      price:
        payload.bulkDiscount?.price === "" ||
        payload.bulkDiscount?.price === undefined ||
        payload.bulkDiscount?.price === null
          ? null
          : payload.bulkDiscount.price,
    };
  }

  if (payload.price !== undefined && payload.price === "") payload.price = null;
  if (payload.discountedPrice !== undefined && payload.discountedPrice === "") {
    payload.discountedPrice = null;
  }
  if (payload.discountMinQty !== undefined && payload.discountMinQty === "") {
    payload.discountMinQty = null;
  }
  if (payload.quantity !== undefined && payload.quantity === "") payload.quantity = null;
  if (payload.minOrder !== undefined && payload.minOrder === "") payload.minOrder = null;
  if (payload.maxOrder !== undefined && payload.maxOrder === "") payload.maxOrder = null;

  return payload;
};

/* =========================================
   CREATE PRODUCT
========================================= */
const createProduct = asyncHandler(async (req, res) => {
  try {
    req.body = normalizeProductPayload(req.body);

    const check = validatePricingPayload({ body: req.body, existing: null });
    if (!check.ok) return res.status(400).json({ message: check.message });

    const colorCheck = validateColorVariantsPayload({
      body: req.body,
      existing: null,
    });
    if (!colorCheck.ok) return res.status(400).json({ message: colorCheck.message });

    const newProduct = await Product.create(req.body);

    return res.status(201).json({
      message: "Product created successfully",
      data: newProduct,
    });
  } catch (error) {
    console.error("Error creating product:", error);
    const status = isValidationLikeError(error) ? 400 : 500;
    return res.status(status).json({
      message: error?.message || "Product creation failed",
      error: error?.message,
    });
  }
});

/* =========================================
   UPDATE PRODUCT
   IMPORTANT:
   Use document save() so pre('validate') / pre('save') logic runs
========================================= */
const updateProduct = asyncHandler(async (req, res) => {
  const id = req.params.id;
  validateMongoDbId(id);

  try {
    req.body = normalizeProductPayload(req.body);

    const existing = await Product.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    const check = validatePricingPayload({ body: req.body, existing });
    if (!check.ok) return res.status(400).json({ message: check.message });

    const colorCheck = validateColorVariantsPayload({
      body: req.body,
      existing,
    });
    if (!colorCheck.ok) return res.status(400).json({ message: colorCheck.message });

    Object.keys(req.body).forEach((key) => {
      existing[key] = req.body[key];
    });

    const updated = await existing.save();

    return res.json({
      message: "Product updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(`Error updating product with ID ${id}:`, error);
    const status = isValidationLikeError(error) ? 400 : 500;
    return res.status(status).json({
      message: error?.message || "Internal Server Error",
      error: error?.message,
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

    return res.json({
      message: "Product deleted successfully",
      data: deletedProduct,
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error?.message,
    });
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
    .populate({ path: "colorVariants.color", model: "Color" });

  if (!findProduct) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json({ data: findProduct });
});

/* =========================================
   GET ALL PRODUCTS
   Supports:
   - search / searchTerm / q
   - pagination
   - sort
   - fields
   - filtering
========================================= */
const getAllProduct = asyncHandler(async (req, res) => {
  const queryObj = { ...req.query };

  const searchRaw = (queryObj.search ?? queryObj.searchTerm ?? queryObj.q ?? "")
    .toString()
    .trim();

  delete queryObj.search;
  delete queryObj.searchTerm;
  delete queryObj.q;

  const excludeFields = ["page", "sort", "limit", "fields"];
  excludeFields.forEach((el) => delete queryObj[el]);

  let queryStr = JSON.stringify(queryObj);
  queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
  const filter = JSON.parse(queryStr);

  if (searchRaw) {
    const escaped = searchRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped, "i");
    filter.$or = [{ title: rx }, { description: rx }, { brand: rx }, { tags: rx }];
  }

  const sortBy = req.query.sort ? req.query.sort.split(",").join(" ") : "-createdAt";
  const selectFields = req.query.fields ? req.query.fields.split(",").join(" ") : "-__v";

  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Number(req.query.limit || 100));
  const skip = (page - 1) * limit;

  const total = await Product.countDocuments(filter);
  const pages = total === 0 ? 0 : Math.ceil(total / limit);

  if (total > 0 && page > pages) {
    return res.status(200).json({
      total,
      page,
      limit,
      pages,
      hasNextPage: false,
      hasPrevPage: pages > 0,
      data: [],
      message: "No results for this page",
    });
  }

  const data = await Product.find(filter)
    .populate("color")
    .populate("size")
    .populate("category")
    .populate({ path: "colorVariants.color", model: "Color" })
    .sort(sortBy)
    .select(selectFields)
    .skip(skip)
    .limit(limit);

  return res.json({
    total,
    page,
    limit,
    pages,
    hasNextPage: pages > 0 ? page < pages : false,
    hasPrevPage: pages > 0 ? page > 1 : false,
    data,
  });
});

/* =========================================
   ADD TO WISHLIST
========================================= */
const addToWhishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.body;

  validateMongoDbId(prodId);
  validateMongoDbId(_id);

  try {
    const user = await User.findById(_id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadyAdded = user.wishlist.find((id) => id.toString() === prodId);

    const updatedUser = alreadyAdded
      ? await User.findByIdAndUpdate(_id, { $pull: { wishlist: prodId } }, { new: true })
      : await User.findByIdAndUpdate(_id, { $push: { wishlist: prodId } }, { new: true });

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({
      message: "Error adding to wishlist",
      error: error?.message,
    });
  }
});

/* =========================================
   RATING
========================================= */
const rating = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { star, prodId, comment } = req.body;

  validateMongoDbId(prodId);
  validateMongoDbId(_id);

  const numericStar = Number(star);

  if (!Number.isFinite(numericStar) || numericStar < 1 || numericStar > 5) {
    return res.status(400).json({ message: "star must be a number between 1 and 5" });
  }

  const safeComment =
    comment === undefined || comment === null ? "" : String(comment).trim();

  const product = await Product.findById(prodId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const alreadyRated = product.ratings.find(
    (r) => r.postedBy.toString() === _id.toString()
  );

  if (alreadyRated) {
    await Product.updateOne(
      { _id: prodId, "ratings.postedBy": _id },
      {
        $set: {
          "ratings.$.star": numericStar,
          "ratings.$.comment": safeComment,
        },
      }
    );
  } else {
    await Product.findByIdAndUpdate(
      prodId,
      {
        $push: {
          ratings: { star: numericStar, comment: safeComment, postedBy: _id },
        },
      },
      { new: true }
    );
  }

  const refreshed = await Product.findById(prodId);
  const total = refreshed?.ratings?.length || 0;
  const sum = (refreshed?.ratings || []).reduce(
    (acc, r) => acc + (Number(r.star) || 0),
    0
  );

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