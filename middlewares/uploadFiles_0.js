const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Ensure directories exist
const uploads = path.join(__dirname, '../public/uploads');
fs.ensureDirSync(uploads);

// Multer storage configuration
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploads);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); 
  },
});

// Multer file filter
const multerFilter = (req, file, cb) => {
  // Optionally: filter based on file type or size
  // For general files, you might not need a specific filter
  cb(null, true); // Accept all files
};

// Multer upload middleware
const uploadFile = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB size limit
});




module.exports = { uploadFile };