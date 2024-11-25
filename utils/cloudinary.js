const cloudinary = require('cloudinary').v2;

// Configuring Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.SECRET_KEY,
});

// Upload an image from a buffer (in-memory storage)
const cloudinaryUploadImg = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
      if (error) {
        console.error('Cloudinary upload error:', error);
        return reject(error);
      }
      resolve({
        url: result.secure_url,
        asset_id: result.asset_id,
        public_id: result.public_id,
      });
    });
    stream.end(fileBuffer); // Pass the file buffer here
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

// Upload raw files (documents, PDFs, etc.) to Cloudinary
const cloudinaryUploadFile = (filePath, fileName, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    const publicId = `documents/${fileName.split('.').slice(0, -1).join('.')}`; // Remove extension

    cloudinary.uploader.upload(
      filePath,
      {
        resource_type: resourceType,  // 'raw' for documents
        public_id: publicId,
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
    );
  });
};

const cloudinaryDeleteFile = (publicId, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        return reject(error);
      }
      if (result.result === 'ok') {
        console.log(`File ${publicId} deleted successfully`);
        resolve(result);
      } else {
        console.error(`File ${publicId} could not be deleted`);
        reject(new Error('File not found or could not be deleted'));
      }
    });
  });
};

module.exports = {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  cloudinaryUploadFile,
  cloudinaryDeleteFile,
};