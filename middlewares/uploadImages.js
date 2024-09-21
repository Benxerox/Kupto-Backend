const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

// Ensure directories exist
const images = path.join(__dirname, '../public/images');
const products = path.join(images, 'products');
fs.ensureDirSync(images);
fs.ensureDirSync(products);

// Multer storage configuration
const multerStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, images);
  },
  filename: function(req, file, cb){
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ".jpeg"); 
  },
});

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

const productImgResize = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    await Promise.all(req.files.map(async (file) => {
      const newFilePath = path.join(products, file.filename);

      // Resize image and save it to the new file path
      await sharp(file.path)
        .resize(300, 300)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(newFilePath);
      
      // Delete the original file asynchronously
      fs.unlink(file.path, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`Error deleting file ${file.path}:`, unlinkErr);
        } else {
          console.log(`Successfully deleted file ${file.path}`);
        }
      });
    }));

    next();
  } catch (error) {
    console.error('Error resizing images:', error);
    next(error); // Pass the error to the error handling middleware
  }
};

module.exports = { uploadPhoto, productImgResize };


