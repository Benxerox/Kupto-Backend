const express = require('express');
const { uploadImages, deleteImages } = require('../controller/uploadCtrl');
const { isAdmin, authMiddleware } = require('../middlewares/authMiddleware');
const { uploadPhoto, productImgResize } = require('../middlewares/uploadImages');

const router = express.Router();

router.post(
  '/', 
  authMiddleware, 
  isAdmin, 
  uploadPhoto.array('images', 10),  // Handle up to 10 images
  productImgResize,  // Resize the images
  uploadImages       // Upload images to Cloudinary
);

router.delete('/delete-img/:id', authMiddleware, isAdmin, deleteImages);

module.exports = router;