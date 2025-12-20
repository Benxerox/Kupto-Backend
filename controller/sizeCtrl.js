const Size = require('../models/sizeModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const validateMongoDbId = require('../utils/validateMongodbid');




const createSize = asyncHandler(async (req, res) => {
  try {
    console.log('Received Request Body:', req.body); // Log the received request body
    
    // Check if title and price are included
    if (!req.body.title || req.body.price === undefined) {
      return res.status(400).json({ message: 'Title and price are required.' });
    }

    // Create slug from title
    req.body.slug = slugify(req.body.title);

    // Log the size object before saving
    console.log('Size to be created:', req.body);

    // Create a new Size document
    const newSize = await Size.create(req.body);

    // Log the created size document
    console.log('Created Size:', newSize);

    // Send the created size back as response
    res.status(201).json({ newSize });
  } catch (error) {
    console.error('Error creating size:', error);
    res.status(500).json({ error: error.message });
  }
});

const updateSize = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const updatedSize = await Size.findByIdAndUpdate(id,req.body,{
      new: true,
    });
    res.json(updatedSize);
  } catch (error) {
    throw new Error (error);
  }
});

const deleteSize = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const deletedSize = await Size.findByIdAndDelete(id);
    res.json(deletedSize);
  } catch (error) {
    throw new Error (error);
  }
});

const getSize = asyncHandler(async(req, res)=>{
  const {id} =  req.params;
  validateMongoDbId(id);
  try {
    const getaSize = await Size.findById(id);
    res.json(getaSize);
  } catch (error) {
    throw new Error (error);
  }
});


const getallSize = asyncHandler(async(req, res)=>{
 
  try {
    const getallSize = await Size.find();
    res.json(getallSize);
  } catch (error) {
    throw new Error (error);
  }
});



module.exports = {createSize, updateSize, deleteSize, getSize, getallSize};