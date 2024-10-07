const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

// Multer storage configuration - memory storage to avoid file system issues
const multerStorage = multer.memoryStorage();

// Multer file filter
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb({ message: 'Unsupported file format' }, false);
  }
};

// Multer upload middleware
const uploadPhoto = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB size limit
});

// Middleware to resize images
const productImgResize = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    await Promise.all(req.files.map(async (file) => {
      const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpeg`;

      // Resize image and save it in memory
      const resizedBuffer = await sharp(file.buffer)
        .resize(300, 300)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toBuffer();

      // Replace file buffer with the resized image
      file.buffer = resizedBuffer;
      file.filename = filename;
    }));

    next();
  } catch (error) {
    console.error('Error resizing images:', error);
    next(error); // Pass the error to the error handling middleware
  }
};

module.exports = { uploadPhoto, productImgResize };