const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.SECRET_KEY,
});

// Multer storage configuration
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

// Resize and upload images to Cloudinary
const productImgResize = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    const uploadPromises = req.files.map(async (file) => {
      // Resize image
      const resizedImageBuffer = await sharp(file.buffer)
        .resize(300, 300)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toBuffer();

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(resizedImageBuffer, {
        resource_type: 'image',
        public_id: file.originalname.split('.')[0], // Customize public ID as needed
        overwrite: true,
        folder: 'documents', // Corrected to 'folder'
      });

      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    });

    // Wait for all uploads to finish
    req.uploadedFiles = await Promise.all(uploadPromises);
    next();
  } catch (error) {
    console.error('Error processing and uploading images:', error);
    next(error); // Pass the error to the error handling middleware
  }
};

module.exports = { uploadPhoto, productImgResize };