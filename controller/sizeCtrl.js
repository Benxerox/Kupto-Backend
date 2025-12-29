const Size = require("../models/sizeModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbid");

const toNumberOrNull = (v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const createSize = asyncHandler(async (req, res) => {
  const body = { ...req.body };

  // ✅ schema uses `name` (not title)
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ message: "name is required." });
  }

  // ✅ auto slug (safe)
  body.slug = slugify(body.name, { lower: true, strict: true });

  // ✅ normalize numeric fields (handles form-data strings)
  body.price = toNumberOrNull(body.price);
  body.discountPrice = toNumberOrNull(body.discountPrice);
  body.priceAdjustment = body.priceAdjustment === undefined ? 0 : Number(body.priceAdjustment || 0);
  body.width = toNumberOrNull(body.width);
  body.height = toNumberOrNull(body.height);
  body.sortOrder = body.sortOrder === undefined ? 0 : Number(body.sortOrder || 0);

  // ✅ if price not provided, discountPrice must not be provided
  if ((body.price === null || body.price === undefined) && body.discountPrice != null) {
    return res.status(400).json({
      message: "discountPrice requires price. Either set price or remove discountPrice.",
    });
  }

  // ✅ ensure discountPrice < price (extra guard; schema also validates)
  if (body.price != null && body.discountPrice != null && body.discountPrice >= body.price) {
    return res.status(400).json({ message: "discountPrice must be less than price." });
  }

  const newSize = await Size.create(body);
  res.status(201).json(newSize);
});

const updateSize = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const body = { ...req.body };

  // ✅ if name changes, update slug
  if (body.name) {
    body.slug = slugify(body.name, { lower: true, strict: true });
  }

  // ✅ normalize numbers (important if coming from form inputs)
  if ("price" in body) body.price = toNumberOrNull(body.price);
  if ("discountPrice" in body) body.discountPrice = toNumberOrNull(body.discountPrice);
  if ("priceAdjustment" in body) body.priceAdjustment = Number(body.priceAdjustment || 0);
  if ("width" in body) body.width = toNumberOrNull(body.width);
  if ("height" in body) body.height = toNumberOrNull(body.height);
  if ("sortOrder" in body) body.sortOrder = Number(body.sortOrder || 0);

  // ✅ if price is removed, also remove discountPrice to avoid validation failure
  if ("price" in body && (body.price === null || body.price === undefined)) {
    body.discountPrice = null;
  }

  const updatedSize = await Size.findByIdAndUpdate(id, body, {
    new: true,
    runValidators: true, // ✅ important for discountPrice validation
  });

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
