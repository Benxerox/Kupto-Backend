const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

// Multer setup for temporary local storage
const multerStorage = multer.memoryStorage(); // Store file in memory buffer

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
  storage: multerStorage, // In-memory storage
  fileFilter: multerFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB size limit
});

const productImgResize = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    // Resize and upload to Cloudinary
    await Promise.all(req.files.map(async (file) => {
      const resizedImageBuffer = await sharp(file.buffer)
        .resize(300, 300)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toBuffer(); // Resize image and return as a buffer

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload_stream({
        folder: 'products',
        format: 'jpeg',
      }, (error, uploadResult) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return next(error);
        }
        console.log('Successfully uploaded to Cloudinary:', uploadResult);
        file.cloudinaryUrl = uploadResult.secure_url; // Store the Cloudinary URL
      }).end(resizedImageBuffer); // Pass buffer directly to upload stream
    }));

    next();
  } catch (error) {
    console.error('Error processing images:', error);
    next(error);
  }
};

module.exports = { uploadPhoto, productImgResize };


