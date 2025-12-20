/*const Color = require('../models/colorModel');
const asyncHandler = require('express-async-handler');
const validateMongoDbId = require('../utils/validateMongodbid');
const slugify = require("slugify");



const createColor = asyncHandler(async (req, res) => {
  try {
    if (req.body?.name && !req.body?.slug) {
      req.body.slug = slugify(req.body.name, { lower: true, strict: true });
    }

    const newColor = await Color.create(req.body);
    res.json(newColor);
  } catch (error) {
    throw new Error(error);
  }
});

const updateColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    if (req.body?.name && !req.body?.slug) {
      req.body.slug = slugify(req.body.name, { lower: true, strict: true });
    }

    const updatedColor = await Color.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true, // ✅ important so hex regex + validations apply on update
    });

    res.json(updatedColor);
  } catch (error) {
    throw new Error(error);
  }
});

const deleteColor = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const deletedColor = await Color.findByIdAndDelete(id);
    res.json(deletedColor);
  } catch (error) {
    throw new Error (error);
  }
});
const getColor = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const getaColor = await Color.findById(id);
    res.json(getaColor);
  } catch (error) {
    throw new Error (error);
  }
});


const getallColor = asyncHandler(async(req, res)=>{
 
  try {
    const getallColor = await Color.find();
    res.json(getallColor);
  } catch (error) {
    throw new Error (error);
  }
});



module.exports = {createColor, updateColor, deleteColor, getColor, getallColor};*/

const Color = require("../models/colorModel");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongodbid");
const slugify = require("slugify");

const buildSlug = (name = "") =>
  slugify(String(name), { lower: true, strict: true, trim: true });

const pickColorFields = (body = {}) => {
  const picked = {};

  if (typeof body.name === "string") picked.name = body.name.trim();
  if (typeof body.hex === "string") picked.hex = body.hex.trim().toUpperCase();
  if (typeof body.printNotes === "string") picked.printNotes = body.printNotes;

  if (typeof body.isActive === "boolean") picked.isActive = body.isActive;
  if (typeof body.isActive === "string") {
    if (body.isActive.toLowerCase() === "true") picked.isActive = true;
    if (body.isActive.toLowerCase() === "false") picked.isActive = false;
  }

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isNaN(n)) picked.sortOrder = n;
  }

  // optional swatchImage object
  if (body.swatchImage && typeof body.swatchImage === "object") {
    picked.swatchImage = {
      public_id: body.swatchImage.public_id || "",
      url: body.swatchImage.url || "",
    };
  }

  return picked;
};

const createColor = asyncHandler(async (req, res) => {
  const data = pickColorFields(req.body);

  if (!data.name) {
    res.status(400);
    throw new Error("Color name is required.");
  }
  if (!data.hex) {
    res.status(400);
    throw new Error("HEX color is required.");
  }

  data.slug = buildSlug(data.name);

  if (req.user?._id) data.createdBy = req.user._id;

  const exists = await Color.findOne({
    $or: [{ name: data.name }, { slug: data.slug }],
  });

  if (exists) {
    res.status(409);
    throw new Error("A color with this name already exists.");
  }

  const newColor = await Color.create(data);
  res.status(201).json(newColor);
});

const updateColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const update = pickColorFields(req.body);
  if (update.name) update.slug = buildSlug(update.name);

  const updatedColor = await Color.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!updatedColor) {
    res.status(404);
    throw new Error("Color not found.");
  }

  res.json(updatedColor);
});

const deleteColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const deletedColor = await Color.findByIdAndDelete(id);

  if (!deletedColor) {
    res.status(404);
    throw new Error("Color not found.");
  }

  res.json({ message: "Color deleted successfully.", deletedColor });
});

const getColor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  const color = await Color.findById(id);

  if (!color) {
    res.status(404);
    throw new Error("Color not found.");
  }

  res.json(color);
});

const getallColor = asyncHandler(async (req, res) => {
  const { active, q, sort } = req.query;
  const filter = {};

  if (active !== undefined) {
    if (String(active).toLowerCase() === "true") filter.isActive = true;
    if (String(active).toLowerCase() === "false") filter.isActive = false;
  }

  if (q) {
    const s = String(q).trim();
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { hex: { $regex: s, $options: "i" } },
      { slug: { $regex: s, $options: "i" } },
    ];
  }

  const allowedSorts = new Set([
    "sortOrder",
    "-sortOrder",
    "name",
    "-name",
    "createdAt",
    "-createdAt",
  ]);

  const sortValue = allowedSorts.has(sort) ? sort : "sortOrder";

  const colors = await Color.find(filter).sort(sortValue);
  res.json(colors);
});

module.exports = { createColor, updateColor, deleteColor, getColor, getallColor };
