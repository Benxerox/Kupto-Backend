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




const getaPoster = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);
  
  try {
    const findPoster = await Poster.findById(id);
    
    // Check if the poster was found
    if (!findPoster) {
      // Return a 404 status if not found
      return res.status(404).json({ message: "Poster not found" });
    }

    res.status(200).json(findPoster);
  } catch (error) {
    console.error("Error fetching poster:", error); // Log the error for debugging
    res.status(500).json({ message: "Server error", error: error.message }); // Return a server error response
  }
});







const getAllPoster = asyncHandler(async (req, res) => {
  try {
    // Filtering
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

    // Pagination
    const page = parseInt(req.query.page, 10) || 1; // Ensure it's a number
    const limit = parseInt(req.query.limit, 10) || 10; // Ensure it's a number
    const skip = (page - 1) * limit;

    // Validate the pagination values
    if (skip < 0) {
      return res.status(400).json({ success: false, message: 'Invalid page number' });
    }

    const posterCount = await Poster.countDocuments();
    if (skip >= posterCount && page > 1) {
      return res.status(404).json({ success: false, message: 'This page does not exist' });
    }

    query = query.skip(skip).limit(limit);
    const posters = await query;

    res.status(200).json({ success: true, posters, total: posterCount, currentPage: page });
  } catch (error) {
    console.error("Error fetching posters:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: error.message });
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



<<<<<<< HEAD
=======












>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
module.exports = {
  createPoster, 
  getaPoster, 
  getAllPoster, 
  updatePoster, 
  deletePoster, 
  
  
<<<<<<< HEAD
};
=======
};

>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
