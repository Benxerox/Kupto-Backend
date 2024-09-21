const Poster = require('../models/posterModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const validateMongoDbId = require('../utils/validateMongodbid');
const User = require('../models/userModel');
const path = require('path');





const createPoster = asyncHandler(async(req, res)=> {
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
   
    const newPoster = await Poster.create(req.body);
    res.json({newPoster});
  } catch (error) {
   
    throw new Error(error);
  }
});

const updatePoster = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const updatePoster = await Poster.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true // Ensures schema validation during update
    });
    
    res.json(updatePoster);
  } catch (error) {
    
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


const deletePoster = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    const deletePoster = await Poster.findOneAndDelete({ _id: id });
    res.json(deletePoster);
  } catch (error) {
    throw new Error(error);
  }
});




const getaPoster = asyncHandler(async(req, res)=>{
  const {id} = req.params;
  validateMongoDbId(id);
  try {
    const findPoster = await Poster.findById(id);
    res.json(findPoster);
  } catch (error) {
    throw new Error(error)
  }
});







const getAllPoster = asyncHandler(async (req, res) => {
  try {
    //filtering
    const queryObj = { ...req.query };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach(el => delete queryObj[el]);
    
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    let query = Poster.find(JSON.parse(queryStr));

    // Sorting
   
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Limiting the fields
    if (req.query.fields) {
      const fields = req.query.fields.split(',').join(' ');
      query = query.select(fields);
    } else {
      query = query.select('-__v');
    }

    //Pagination

    const page = req.query.page;
    const limit = req.query.limit;
    const skip = (page-1)* limit;
    query = query.skip(skip).limit(limit);
    if(req.query.page) {
      const posterCount = await Poster.countDocuments();
      if (skip>=posterCount) throw new Error('This Page does not exist');
    }
    console.log(page, limit, skip)


    const poster = await query;
    res.json(poster);
  } catch (error) {
    throw new Error(error);
  }
});










// Function to delete a file from a directory with proper error handling
async function deleteFile(path) {
  try {
    await fs.chmod(path, 0o666); // Change file permissions
    await fs.unlink(path); // Delete the file
    console.log(`Successfully deleted file ${path}`);
  } catch (fsError) {
    console.error(`Error handling file ${path}:`, fsError);

    // Log additional details about the file
    try {
      const fileStats = await fs.stat(path);
      console.error(`File stats: ${JSON.stringify(fileStats)}`);
    } catch (statError) {
      console.error(`Error retrieving stats for file ${path}:`, statError);
    }
  }
}















module.exports = {
  createPoster, 
  getaPoster, 
  getAllPoster, 
  updatePoster, 
  deletePoster, 
  
  
};

