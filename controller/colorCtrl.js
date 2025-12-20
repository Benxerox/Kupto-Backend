const Color = require('../models/colorModel');
const asyncHandler = require('express-async-handler');
const validateMongoDbId = require('../utils/validateMongodbid');
<<<<<<< HEAD
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
=======


const createColor = asyncHandler(async(req, res)=>{
  try {
    const newColor = await Color.create(req.body);
    res.json(newColor);
  } catch (error) {
    throw new Error (error);
  }
});

const updateColor = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const updatedColor = await Color.findByIdAndUpdate(id,req.body,{
      new: true,
    });
    res.json(updatedColor);
  } catch (error) {
    throw new Error (error);
>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
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



module.exports = {createColor, updateColor, deleteColor, getColor, getallColor};