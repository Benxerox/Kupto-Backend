const express = require("express");
const { uploadImages } = require("../controller/uploadCtrl");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");
const { uploadPostPhoto } = require("../middlewares/uploadImages");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  isAdmin,
  uploadPostPhoto.array("images", 20), // ✅ NO resize here
  uploadImages
);

module.exports = router;
