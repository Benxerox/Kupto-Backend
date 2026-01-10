const OtherPost = require("../models/otherPostModel");
const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const validateMongoDbId = require("../utils/validateMongodbid");

const makeSlug = (title = "") =>
  slugify(String(title), { lower: true, strict: true, trim: true });

const isMongoId = (val) => /^[0-9a-fA-F]{24}$/.test(String(val || ""));

/* =========================
   CREATE
========================= */
const createPost = asyncHandler(async (req, res) => {
  try {
    // ✅ ensure slug exists if title provided
    if (req.body?.title) {
      const slug = makeSlug(req.body.title);
      req.body.slug = slug;

      const existing = await OtherPost.findOne({ slug });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Slug already exists" });
      }
    }

    const newPost = await OtherPost.create(req.body);
    res.status(201).json({ success: true, newPost });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/* =========================
   UPDATE
========================= */
const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    // ✅ if title changes, update slug and ensure uniqueness excluding current doc
    if (req.body?.title) {
      const slug = makeSlug(req.body.title);
      req.body.slug = slug;

      const existing = await OtherPost.findOne({ slug, _id: { $ne: id } });
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Slug already exists" });
      }
    }

    const updatedPost = await OtherPost.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedPost) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, updatedPost });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/* =========================
   DELETE
========================= */
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const deletedPost = await OtherPost.findByIdAndDelete(id);

    if (!deletedPost) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, deletedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================
   GET ONE (id OR slug)
========================= */
const getaPost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    let post = null;

    if (isMongoId(id)) {
      validateMongoDbId(id);
      post = await OtherPost.findById(id);
    } else {
      // treat as slug
      post = await OtherPost.findOne({ slug: String(id).toLowerCase().trim() });
    }

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, post });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

/* =========================
   GET ALL (filter/sort/fields/paginate)
========================= */
const getAllPost = asyncHandler(async (req, res) => {
  try {
    // Filtering
    const queryObj = { ...req.query };
    const excludeFields = ["page", "sort", "limit", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(
      /\b(gte|gt|lte|lt)\b/g,
      (match) => `$${match}`
    );

    const filter = JSON.parse(queryStr);

    let query = OtherPost.find(filter);

    // Sorting
    if (req.query.sort) {
      const sortBy = String(req.query.sort).split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // Field limiting
    if (req.query.fields) {
      const fields = String(req.query.fields).split(",").join(" ");
      query = query.select(fields);
    } else {
      query = query.select("-__v");
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalPosts = await OtherPost.countDocuments(filter);

    if (skip >= totalPosts && page > 1) {
      return res
        .status(404)
        .json({ success: false, message: "This page does not exist" });
    }

    const posts = await query.skip(skip).limit(limit);

    res.status(200).json({
      success: true,
      posts,
      totalPosts,
      currentPage: page,
      totalPages: Math.ceil(totalPosts / limit) || 1,
    });
  } catch (error) {
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
