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

const hasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj || {}, key);

const validatePayload = (body, { partial = false } = {}) => {
  // CREATE validation
  if (!partial) {
    if (!body?.title || String(body.title).trim() === "") return "Title is required.";
    if (!body?.printPrice) return "printPrice is required (oneSide, twoSide).";
    if (body.printPrice.oneSide === undefined || body.printPrice.twoSide === undefined) {
      return "Both printPrice.oneSide and printPrice.twoSide are required.";
    }
  }

  // UPDATE validation (only validate what is provided)
  if (partial && hasOwn(body, "title")) {
    if (!String(body.title || "").trim()) return "Title cannot be empty.";
  }

  if (hasOwn(body, "discountMinQty")) {
    const d = toNum(body.discountMinQty, NaN);
    if (!Number.isFinite(d) || d < 0) return "discountMinQty must be a number ≥ 0.";
  }

  if (hasOwn(body, "preparePrice")) {
    const p = toNum(body.preparePrice, NaN);
    if (!Number.isFinite(p) || p < 0) return "preparePrice must be a number ≥ 0.";
  }

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
    const errMsg = validatePayload(req.body, { partial: false });
    if (errMsg) return res.status(400).json({ message: errMsg });

    const payload = {
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
    const errMsg = validatePayload(req.body, { partial: true });
    if (errMsg) return res.status(400).json({ message: errMsg });

    const nextBody = { ...req.body };

    if (hasOwn(nextBody, "title")) nextBody.title = String(nextBody.title || "").trim();
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
      runValidators: true,
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

  const deletedPrice = await Pprice.findByIdAndDelete(id);
  if (!deletedPrice) return res.status(404).json({ message: "Price not found for deletion." });

  return res.json({ message: "Price deleted successfully", deletedPrice });
});

/* =========================
   GET ONE
========================= */
const getPrice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const price = await Pprice.findById(id);
  if (!price) return res.status(404).json({ message: "Price not found." });

  return res.json(price);
});

/* =========================
   GET ALL
========================= */
const getAllPrice = asyncHandler(async (req, res) => {
  const prices = await Pprice.find().sort({ createdAt: -1 });
  return res.json(prices);
});

module.exports = { createPrice, updatePrice, deletePrice, getPrice, getAllPrice };
