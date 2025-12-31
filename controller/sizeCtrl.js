// controllers/sizeCtrl.js
const Size = require("../models/sizeModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbid");

const toNumberOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toIntOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const createSize = asyncHandler(async (req, res) => {
  const body = { ...req.body };

  // name required
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ message: "name is required." });
  }

  // slug
  body.slug = slugify(body.name, { lower: true, strict: true });

  // normalize numeric fields
  body.price = toNumberOrNull(body.price);
  body.discountPrice = toNumberOrNull(body.discountPrice);
  body.discountMinQty = toIntOrNull(body.discountMinQty); // ✅ NEW
  body.priceAdjustment =
    body.priceAdjustment === undefined ? 0 : Number(body.priceAdjustment || 0);
  body.width = toNumberOrNull(body.width);
  body.height = toNumberOrNull(body.height);
  body.sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder || 0);

  // ✅ RULE 1: if price exists, enforce discountPrice < price
  if (body.price != null && body.discountPrice != null && body.discountPrice >= body.price) {
    return res.status(400).json({ message: "discountPrice must be less than price." });
  }

  // ✅ RULE 2: if discountMinQty is provided, discountPrice must exist
  if (body.discountMinQty != null && body.discountPrice == null) {
    return res
      .status(400)
      .json({ message: "discountMinQty requires discountPrice to be set." });
  }

  const newSize = await Size.create(body);
  res.status(201).json(newSize);
});

const updateSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const body = { ...req.body };

  // update slug if name changes
  if (body.name) {
    body.slug = slugify(body.name, { lower: true, strict: true });
  }

  // normalize numbers only when sent
  if ("price" in body) body.price = toNumberOrNull(body.price);
  if ("discountPrice" in body) body.discountPrice = toNumberOrNull(body.discountPrice);
  if ("discountMinQty" in body) body.discountMinQty = toIntOrNull(body.discountMinQty); // ✅ NEW
  if ("priceAdjustment" in body) body.priceAdjustment = Number(body.priceAdjustment || 0);
  if ("width" in body) body.width = toNumberOrNull(body.width);
  if ("height" in body) body.height = toNumberOrNull(body.height);
  if ("sortOrder" in body) body.sortOrder = Number(body.sortOrder || 0);

  // ✅ if discountPrice is removed, also remove discountMinQty
  if ("discountPrice" in body && (body.discountPrice === null || body.discountPrice === undefined)) {
    body.discountMinQty = null;
  }

  // ✅ if discountMinQty is set, require discountPrice (handles partial updates)
  if ("discountMinQty" in body && body.discountMinQty != null) {
    // if client didn't send discountPrice in this update, we must check current doc
    if (!("discountPrice" in body)) {
      const existing = await Size.findById(id).select("discountPrice");
      if (!existing) return res.status(404).json({ message: "Size not found" });
      if (existing.discountPrice == null) {
        return res
          .status(400)
          .json({ message: "discountMinQty requires discountPrice to be set." });
      }
    } else {
      if (body.discountPrice == null) {
        return res
          .status(400)
          .json({ message: "discountMinQty requires discountPrice to be set." });
      }
    }
  }

  // ✅ if price exists and discountPrice exists, enforce discountPrice < price
  // (handles partial updates: if only discountPrice sent, compare to current price)
  if ("discountPrice" in body && body.discountPrice != null) {
    let priceToCompare = body.price;

    if (priceToCompare == null && !("price" in body)) {
      const existing = await Size.findById(id).select("price");
      if (!existing) return res.status(404).json({ message: "Size not found" });
      priceToCompare = existing.price;
    }

    if (priceToCompare != null && body.discountPrice >= priceToCompare) {
      return res.status(400).json({ message: "discountPrice must be less than price." });
    }
  }

  
  const updatedSize = await Size.findByIdAndUpdate(id, body, {
  new: true,
  runValidators: true,
  context: "query", // ✅ IMPORTANT
});


  if (!updatedSize) return res.status(404).json({ message: "Size not found" });

  res.json(updatedSize);
});

const deleteSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const deletedSize = await Size.findByIdAndDelete(id);
  res.json(deletedSize);
});

const getSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const size = await Size.findById(id);
  res.json(size);
});

const getallSize = asyncHandler(async (req, res) => {
  const sizes = await Size.find().sort({ sortOrder: 1, name: 1 });
  res.json(sizes);
});

module.exports = { createSize, updateSize, deleteSize, getSize, getallSize };
