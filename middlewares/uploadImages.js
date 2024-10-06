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

/*
const multer = require('multer');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

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
    if (!req.files || req.files.length === 0) {
      console.warn('No files received.');
      return next();
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        console.log('Processing file:', file.originalname);
        
        sharp(file.buffer)
          .resize(300, 300)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toBuffer()
          .then((resizedImageBuffer) => {
            const stream = streamifier.createReadStream(resizedImageBuffer); // Create a stream from the buffer

            stream.pipe(
              cloudinary.uploader.upload_stream(
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
                  resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                  });
                }
              )
            );
          })
          .catch((error) => {
            console.error('Error processing image with Sharp:', error);
            reject(error);
          });
      });
    });

    req.uploadedFiles = await Promise.all(uploadPromises);
    console.log('Upload successful:', req.uploadedFiles);
    next();
  } catch (error) {
    console.error('Error processing and uploading images:', error);
    next(error);
  }
};

module.exports = { uploadPhoto, productImgResize }; */
