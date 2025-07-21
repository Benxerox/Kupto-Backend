const Category = require('../models/categoryModel');
const asyncHandler = require('express-async-handler');
const validateMongoDbId = require('../utils/validateMongodbid');



const createCategory = asyncHandler(async(req, res)=>{
  try {
    const newCategory = await Category.create(req.body);
    res.json(newCategory);
  } catch (error) {
    throw new Error (error);
  }
});

const updateCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const updateData = {
      title: req.body.title,
    };

    // Only update images if provided
    if (req.body.images && Array.isArray(req.body.images)) {
      updateData.images = req.body.images;
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(updatedCategory);
  } catch (error) {
    throw new Error(error.message || 'Failed to update category');
  }
});

const deleteCategory = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const deletedCategory = await Category.findByIdAndDelete(id);
    res.json(deletedCategory);
  } catch (error) {
    throw new Error (error);
  }
});
const getCategory = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const getaCategory = await Category.findById(id);
    res.json(getaCategory);
  } catch (error) {
    throw new Error (error);
  }
});


const getallCategory = asyncHandler(async(req, res)=>{
 
  try {
    const getallCategory = await Category.find();
    res.json(getallCategory);
  } catch (error) {
    throw new Error (error);
  }
});




module.exports = {createCategory, updateCategory, deleteCategory, getCategory, getallCategory};