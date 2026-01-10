

// routes/uploadPostRoute.js
const express = require("express");
const { uploadImages, deleteImages } = require("../controller/uploadCtrl");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { uploadPostPhoto } = require("../middlewares/uploadImages");

const router = express.Router();

// ✅ POST images for posts — ORIGINAL SIZE (no sharp resize middleware)
router.post(
  "/",
  authMiddleware,
  isAdmin,
  uploadPostPhoto.array("images", 10),
  uploadImages
);

router.delete("/delete-img/:id", authMiddleware, isAdmin, deleteImages);

module.exports = router;

