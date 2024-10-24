const OtherPost = require('../models/otherPostModel');
const asyncHandler = require('express-async-handler');
const slugify = require('slugify');
const validateMongoDbId = require('../utils/validateMongodbid');

// Create a new post
const createPost = asyncHandler(async (req, res) => {
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
      const existingPost = await OtherPost.findOne({ slug: req.body.slug });
      if (existingPost) {
        return res.status(400).json({ success: false, message: 'Slug already exists' });
      }
    }
    const newPost = await OtherPost.create(req.body);
    res.status(201).json({ success: true, newPost });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update an existing post
const updatePost = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    if (req.body.title) {
      req.body.slug = slugify(req.body.title);
      const existingPost = await OtherPost.findOne({ slug: req.body.slug });
      if (existingPost) {
        return res.status(400).json({ success: false, message: 'Slug already exists' });
      }
    }
    const updatedPost = await OtherPost.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true 
    });
    res.json({ success: true, updatedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// Delete a post
const deletePost = asyncHandler(async (req, res) => {
  const id = req.params.id; 
  validateMongoDbId(id);
  try {
    const deletedPost = await OtherPost.findOneAndDelete({ _id: id });
    res.json({ success: true, deletedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific post
const getaPost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const findPost = await OtherPost.findById(id);

    // Check if the post was found
    if (!findPost) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, post: findPost }); // Changed to "post" for clarity
  } catch (error) {
    console.error("Error fetching post:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// Get all posts
const getAllPost = asyncHandler(async (req, res) => {
  try {
    // Filtering
    const queryObj = { ...req.query };
    const excludeFields = ['page', 'sort', 'limit', 'fields'];
    excludeFields.forEach(el => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

    let query = OtherPost.find(JSON.parse(queryStr));

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

    const postCount = await OtherPost.countDocuments();
    if (skip >= postCount && page > 1) {
      return res.status(404).json({ success: false, message: 'This page does not exist' });
    }

    query = query.skip(skip).limit(limit);
    const posts = await query;

    res.status(200).json({ success: true, posts, totalPosts: postCount, currentPage: page });
  } catch (error) {
    console.error("Error fetching posts:", error); // Log the error for debugging
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  createPost, 
  getaPost, 
  getAllPost, 
  updatePost, 
  deletePost,
};