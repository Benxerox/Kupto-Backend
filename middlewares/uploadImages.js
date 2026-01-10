const multer = require("multer");
const sharp = require("sharp");

// ============================
// Shared config
// ============================
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb({ message: "Unsupported file format" }, false);
  }
};

// ============================
// PRODUCT UPLOAD (resize to 800x800)
// ============================
const uploadPhoto = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for products
});

const productImgResize = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return next();

    await Promise.all(
      req.files.map(async (file) => {
        const resizedImageBuffer = await sharp(file.buffer)
          .resize(800, 800)
          .jpeg({ quality: 80 })
          .toBuffer();

        file.buffer = resizedImageBuffer;
      })
    );

    next();
  } catch (error) {
    console.error("Error resizing product images:", error);
    next(error);
  }
};

// ============================
// POST UPLOAD (NO resize, original dimensions)
// ============================
const uploadPostPhoto = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for posts
});

module.exports = {
  uploadPhoto,       // for products
  productImgResize,  // for products
  uploadPostPhoto,   // for posts (original size)
};
