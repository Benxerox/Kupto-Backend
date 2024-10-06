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

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        // Resize image
        sharp(file.buffer)
          .resize(300, 300)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer()
          .then((resizedImageBuffer) => {
            // Upload to Cloudinary
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: 'image',
                public_id: file.originalname.split('.')[0],
                overwrite: true,
                folder: 'documents',
              },
              (error, result) => {
                if (error) {
                  console.error('Cloudinary upload error:', error);
                  return reject(error);
                }
                if (!result) {
                  const noResultError = new Error('Cloudinary upload returned undefined result');
                  console.error(noResultError);
                  return reject(noResultError);
                }
                resolve({
                  url: result.secure_url,
                  public_id: result.public_id,
                });
              }
            );

            // Pipe the resized image buffer to Cloudinary
            stream.end(resizedImageBuffer);
          })
          .catch((error) => {
            console.error('Error processing image with Sharp:', error);
            reject(error);
          });
      });
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