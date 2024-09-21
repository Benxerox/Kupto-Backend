const cloudinary = require('cloudinary').v2;

// Configuring Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.SECRET_KEY,
});

// Upload an image to Cloudinary
const cloudinaryUploadImg = (fileToUploads) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(fileToUploads, { resource_type: 'auto' }, (error, result) => {
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
        asset_id: result.asset_id,
        public_id: result.public_id,
      });
    });
  });
};

// Delete an image from Cloudinary
const cloudinaryDeleteImg = (publicId, resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        return reject(error);
      }
      resolve(result);
    });
  });
};

// Async handler middleware for error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};


// Upload files to Cloudinary
const cloudinaryUploadFile = (filePath, fileName) => {
  return new Promise((resolve, reject) => {
    const publicId = fileName.split('.').slice(0, -1).join('.'); // Remove extension

    console.log(`Uploading file: ${fileName}, Public ID: ${publicId}`);

    cloudinary.uploader.upload(
      filePath,
      {
        resource_type: 'raw', // Change to 'image' if uploading images
        public_id: publicId,
        overwrite: true, // Ensure it replaces if already exists
        folders: 'documents' // Specify the folder

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
        console.log(`Upload successful: ${result.secure_url}`);
        resolve({
          url: result.secure_url, // URL with the public_id
          public_id: result.public_id, // This should match fileName without extension
        });
      }
    );
  });
};

// Delete files from Cloudinary
const cloudinaryDeleteFile = (publicId, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to delete file with Public ID: ${publicId}`);

    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      console.log('Delete result:', result);
      if (error) {
        console.error('Cloudinary delete error:', error);
        return reject(error);
      }
      if (result.result !== 'ok') {
        const deleteFailedError = new Error(`File could not be deleted. Result: ${result.result}`);
        console.error(deleteFailedError);
        return reject(deleteFailedError);
      }
      resolve(result);
    });
  });
};


module.exports = {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  cloudinaryUploadFile,
  cloudinaryDeleteFile,
};