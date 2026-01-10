const OtherPost = require("../models/otherPostModel");
const asyncHandler = require("express-async-handler");
const validateMongoDbId = require("../utils/validateMongodbid");

const isMongoId = (val) => /^[0-9a-fA-F]{24}$/.test(String(val || ""));

// ✅ helper: normalize images coming from frontend
const normalizeImages = (images = []) => {
  if (!Array.isArray(images)) return [];

  return images
    .map((img, idx) => {
      // allow url or imageUrl from frontend
      const imageUrl = img?.imageUrl || img?.url || "";

      return {
        imageUrl,
        public_id: img?.public_id || "",
        caption: img?.caption || "",
        link: img?.link || "",
        order:
          typeof img?.order === "number"
            ? img.order
            : typeof img?.order === "string" && img.order !== ""
            ? Number(img.order)
            : idx, // fallback to index ordering
      };
    })
    .filter((img) => !!img.imageUrl); // keep only valid ones
};

/* =========================
   CREATE
   POST /api/post
========================= */
const createPost = asyncHandler(async (req, res) => {
  try {
    const images = normalizeImages(req.body?.images);
    const isActive =
      typeof req.body?.isActive === "boolean" ? req.body.isActive : true;

    if (!images.length) {
      return res.status(400).json({
        success: false,
        message: "Please add at least one image (imageUrl is required).",
      });
    }

    const newPost = await OtherPost.create({ images, isActive });

    res.status(201).json({ success: true, newPost });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

/* =========================
   UPDATE
   PUT /api/post/:id
========================= */
const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const updateData = {};

    // ✅ if images is provided, normalize and validate
    if (req.body?.images !== undefined) {
      const images = normalizeImages(req.body.images);

      if (!images.length) {
        return res.status(400).json({
          success: false,
          message: "Images array cannot be empty. Add at least one image.",
        });
      }

      updateData.images = images;
    }

    // ✅ optional: allow toggling active
    if (req.body?.isActive !== undefined) {
      updateData.isActive = Boolean(req.body.isActive);
    }

    const updatedPost = await OtherPost.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedPost) {
      return res.status(404).json({ success: false, message: "Post not found" });
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
   DELETE /api/post/:id
========================= */
const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateMongoDbId(id);

  try {
    const deletedPost = await OtherPost.findByIdAndDelete(id);

    if (!deletedPost) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, deletedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/* =========================
   GET ONE
   GET /api/post/:id
========================= */
const getaPost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    if (!isMongoId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post id" });
    }

    validateMongoDbId(id);

    const post = await OtherPost.findById(id);

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
   GET ALL
   GET /api/post
   supports sort/page/limit/fields + basic filters
========================= */
const getAllPost = asyncHandler(async (req, res) => {
  try {
    // Filtering
    const queryObj = { ...req.query };
    const excludeFields = ["page", "sort", "limit", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (m) => `$${m}`);
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
