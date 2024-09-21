const Product = require('../models/productModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const validateMongoDbId = require('../utils/validateMongodbid');
const User = require('../models/userModel');
const path = require('path');




const createProduct = asyncHandler(async(req, res)=> {
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    
    const newProduct = await Product.create(req.body);
    res.json({newProduct});
  } catch (error) {
    console.error('Error creating product:', error); // Add error logging
    throw new Error(error);
  }
});

const updateProduct = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
    }
    const updateProduct = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true // Ensures schema validation during update
    });
    if (!updateProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(updateProduct);
  } catch (error) {
    console.error('Error updating product:', error); // Detailed error logging
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
});


const deleteProduct = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    const deleteProduct = await Product.findOneAndDelete({ _id: id });
    res.json(deleteProduct);
  } catch (error) {
    throw new Error(error);
  }
});




const getaProduct = asyncHandler(async(req, res)=>{
  const {id} = req.params;
  validateMongoDbId(id);
  try {
    const findProduct = await Product.findById(id)
    .populate('color')
    .populate('size')
    .populate('category');
    res.json(findProduct);
  } catch (error) {
    throw new Error(error)
  }
});







const getAllProduct = asyncHandler(async (req, res) => {
  try {
    //filtering
    const queryObj = { ...req.query };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach(el => delete queryObj[el]);
    
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    
    let query = Product.find(JSON.parse(queryStr));

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
      const productCount = await Product.countDocuments();
      if (skip>=productCount) throw new Error('This Page does not exist');
    }
    


    const product = await query;
    res.json(product);
  } catch (error) {
    throw new Error(error);
  }
});



const addToWhishlist = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { prodId } = req.body;

  try {
    const user = await User.findById(_id);
    const alreadyAdded = user.wishlist.find((id) => id.toString() === prodId);
    let updatedUser;
    if (alreadyAdded) {
      updatedUser = await User.findByIdAndUpdate(
        _id,
        { $pull: { wishlist: prodId } },
        { new: true }
      );
    } else {
      updatedUser = await User.findByIdAndUpdate(
        _id,
        { $push: { wishlist: prodId } },
        { new: true }
      );
    }
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to wishlist', error: error.message });
  }
});



const rating = asyncHandler(async (req, res) => {
  const { _id } = req.user;
  const { star, prodId, comment } = req.body;
  try {
    const product = await Product.findById(prodId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const alreadyRated = product.ratings.find(
      (rating) => rating.postedBy.toString() === _id.toString()
    );
    if (alreadyRated) {
      // Update existing rating
      const updateRating = await Product.updateOne(
        {
          'ratings.postedBy': _id,
          _id: prodId
        },
        {
          $set: { 'ratings.$.star': star, 'ratings.$.comment': comment }
        },
        {
          new: true
        }
      );
     
    } else {
      // Add new rating
      const rateProduct = await Product.findByIdAndUpdate(
        prodId,
        {
          $push: {
            ratings: {
              star: star,
              comment: comment,
              postedBy: _id
            }
          }
        },
        {
          new: true
        }
      );
      
    }
    const getallratings = await Product.findById(prodId);
    let totalRating = getallratings.ratings.length;
    let ratingsum = getallratings.ratings.map((item)=>item.star).reduce((prev, curr)=>prev + curr, 0);
    let actualRating  = Math.round(ratingsum / totalRating);
    let finalproduct = await Product.findByIdAndUpdate(prodId, {
      totalrating: actualRating,
    }, {new: true}
  );
  return res.json(finalproduct);
  } catch (error) {
    throw new Error(error);
  }
});


// Function to delete a file from a directory with proper error handling
async function deleteFile(path) {
  try {
    await fs.chmod(path, 0o666); // Change file permissions
    await fs.unlink(path); // Delete the file
    
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
  createProduct, 
  getaProduct, 
  getAllProduct, 
  updateProduct, 
  deleteProduct, 
  addToWhishlist, 
  rating, 
  
};

