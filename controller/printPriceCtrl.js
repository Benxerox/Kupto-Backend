const Pprice = require("../models/printPriceModel");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongodbid");

/* =========================
   Helpers
========================= */
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const validatePrintPricePayload = (body, { partial = false } = {}) => {
  // partial=false -> create validation
  // partial=true  -> update validation (only validate provided fields)

  if (!partial) {
    if (!body?.title || String(body.title).trim() === "") {
      return "Title is required.";
    }
    if (body?.printPrice === undefined) {
      return "printPrice is required (oneSide, twoSide).";
    }
  }

  // title (if present)
  if (partial && hasOwn(body, "title")) {
    if (!String(body.title || "").trim()) return "Title cannot be empty.";
  }

  // discountMinQty (if present)
  if (hasOwn(body, "discountMinQty")) {
    const dMin = toNum(body.discountMinQty, NaN);
    if (!Number.isFinite(dMin) || dMin < 0) return "discountMinQty must be a number ≥ 0.";
  }

  // preparePrice (if present)
  if (hasOwn(body, "preparePrice")) {
    const p = toNum(body.preparePrice, NaN);
    if (!Number.isFinite(p) || p < 0) return "preparePrice must be a number ≥ 0.";
  }

  // printPrice (if present)
  if (hasOwn(body, "printPrice")) {
    const pp = body.printPrice;
    if (!pp || typeof pp !== "object") return "printPrice must be an object { oneSide, twoSide }.";

    if (!partial || hasOwn(pp, "oneSide")) {
      const one = toNum(pp?.oneSide, NaN);
      if (!Number.isFinite(one) || one < 0) return "printPrice.oneSide must be a number ≥ 0.";
    }

    if (!partial || hasOwn(pp, "twoSide")) {
      const two = toNum(pp?.twoSide, NaN);
      if (!Number.isFinite(two) || two < 0) return "printPrice.twoSide must be a number ≥ 0.";
    }
  }

  // printPriceDiscount (optional, but validate if present)
  if (hasOwn(body, "printPriceDiscount")) {
    const pd = body.printPriceDiscount;
    if (!pd || typeof pd !== "object")
      return "printPriceDiscount must be an object { oneSide, twoSide }.";

    if (!partial || hasOwn(pd, "oneSide")) {
      const one = toNum(pd?.oneSide, NaN);
      if (!Number.isFinite(one) || one < 0) return "printPriceDiscount.oneSide must be a number ≥ 0.";
    }

    if (!partial || hasOwn(pd, "twoSide")) {
      const two = toNum(pd?.twoSide, NaN);
      if (!Number.isFinite(two) || two < 0) return "printPriceDiscount.twoSide must be a number ≥ 0.";
    }
  }

  return null;
};

/* =========================
   CREATE
========================= */
const createPrice = asyncHandler(async (req, res) => {
  try {
    const errMsg = validatePrintPricePayload(req.body, { partial: false });
    if (errMsg) return res.status(400).json({ message: errMsg });

    // normalize title
    const payload = {
      ...req.body,
      title: String(req.body.title).trim(),
      discountMinQty: toNum(req.body.discountMinQty, 0),
      preparePrice: toNum(req.body.preparePrice, 0),
      printPrice: {
        oneSide: toNum(req.body?.printPrice?.oneSide, 0),
        twoSide: toNum(req.body?.printPrice?.twoSide, 0),
      },
      printPriceDiscount: {
        oneSide: toNum(req.body?.printPriceDiscount?.oneSide, 0),
        twoSide: toNum(req.body?.printPriceDiscount?.twoSide, 0),
      },
    };

    const newPrice = await Pprice.create(payload);
    return res.status(201).json({ newPrice });
  } catch (error) {
    // duplicate title
    if (error?.code === 11000) {
      return res.status(400).json({ message: "A print price with this title already exists." });
    }
    return res.status(500).json({ error: error?.message || "Server error" });
  }
});

/* =========================
   UPDATE
========================= */
const updatePrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const errMsg = validatePrintPricePayload(req.body, { partial: true });
    if (errMsg) return res.status(400).json({ message: errMsg });

    // If title provided, normalize it
    const nextBody = { ...req.body };
    if (hasOwn(nextBody, "title")) nextBody.title = String(nextBody.title || "").trim();

    // If nested objects provided, normalize numbers for safety
    if (hasOwn(nextBody, "discountMinQty")) nextBody.discountMinQty = toNum(nextBody.discountMinQty, 0);
    if (hasOwn(nextBody, "preparePrice")) nextBody.preparePrice = toNum(nextBody.preparePrice, 0);

    if (hasOwn(nextBody, "printPrice") && nextBody.printPrice) {
      nextBody.printPrice = {
        ...nextBody.printPrice,
        ...(hasOwn(nextBody.printPrice, "oneSide")
          ? { oneSide: toNum(nextBody.printPrice.oneSide, 0) }
          : {}),
        ...(hasOwn(nextBody.printPrice, "twoSide")
          ? { twoSide: toNum(nextBody.printPrice.twoSide, 0) }
          : {}),
      };
    }

    if (hasOwn(nextBody, "printPriceDiscount") && nextBody.printPriceDiscount) {
      nextBody.printPriceDiscount = {
        ...nextBody.printPriceDiscount,
        ...(hasOwn(nextBody.printPriceDiscount, "oneSide")
          ? { oneSide: toNum(nextBody.printPriceDiscount.oneSide, 0) }
          : {}),
        ...(hasOwn(nextBody.printPriceDiscount, "twoSide")
          ? { twoSide: toNum(nextBody.printPriceDiscount.twoSide, 0) }
          : {}),
      };
    }

    const updatedPrice = await Pprice.findByIdAndUpdate(id, nextBody, {
      new: true,
      runValidators: true, // ✅ important
    });

    if (!updatedPrice) return res.status(404).json({ message: "Price not found for update." });

    return res.json(updatedPrice);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: "A print price with this title already exists." });
    }
    return res.status(500).json({ error: error?.message || "Server error" });
  }
});

/* =========================
   DELETE
========================= */
const deletePrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const deletedPrice = await Pprice.findByIdAndDelete(id);
    if (!deletedPrice) return res.status(404).json({ message: "Price not found for deletion." });
    return res.json({ message: "Price deleted successfully", deletedPrice });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Server error" });
  }
});

/* =========================
   GET ONE
========================= */
const getPrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const price = await Pprice.findById(id);
    if (!price) return res.status(404).json({ message: "Price not found." });
    return res.json(price);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Server error" });
  }
});

/* =========================
   GET ALL
========================= */
const getAllPrice = asyncHandler(async (req, res) => {
  try {
    // optional: sort newest first
    const prices = await Pprice.find().sort({ createdAt: -1 });
    return res.json(prices);
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Server error" });
  }
});

module.exports = { createPrice, updatePrice, deletePrice, getPrice, getAllPrice };
