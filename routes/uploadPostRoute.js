// routes/uploadPostRoute.js

const express = require("express");
const { uploadImages, deleteImages } = require("../controller/uploadCtrl");
const { isAdmin, authMiddleware } = require("../middlewares/authMiddleware");
const { uploadPhoto } = require("../middlewares/uploadImages"); // 👈 NO resize here

const router = express.Router();

/**
 * ============================
 * POST IMAGES UPLOAD (ORIGINAL SIZE)
 * ============================
 * This route is ONLY for post/media uploads.
 * It does NOT use productImgResize, so images keep their original shape.
 */
router.post(
  "/",
  authMiddleware,
  isAdmin,
  uploadPhoto.array("images", 10), // accepts up to 10 images
  uploadImages
);

/**
 * ============================
 * DELETE IMAGE
 * ============================
 */
router.delete("/delete-img/:id", authMiddleware, isAdmin, deleteImages);

module.exports = router;
