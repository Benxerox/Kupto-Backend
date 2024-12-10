const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');


// Multer file filter
const multerStorage = multer.memoryStorage();
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

      const resizedImageBuffer = await sharp(file.buffer)
        .resize(800, 800) // Example: Resize to 800x800
        .jpeg({ quality: 80 }) // Example: Set quality to 80%
        .toBuffer();

      file.buffer = resizedImageBuffer;
      file.filename = filename; // Assign the resized file name
    }));

    next();
  } catch (error) {
    console.error('Error handling images:', error);
    next(error);
  }
};

module.exports = { uploadPhoto, productImgResize };