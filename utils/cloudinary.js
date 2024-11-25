const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

// Function to generate a random 24-character alphanumeric public_id
function generateRandomId() {
  return Math.random().toString(36).substr(2, 24);  // 24-character random ID
}

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
    // Generate a random alphanumeric string for public_id
    const randomPublicId = Math.random().toString(36).substring(2, 15);  // Generate a random string (e.g., iaqahdbi7f)

    cloudinary.uploader.upload(
      filePath,
      {
        resource_type: resourceType,   // 'raw' for documents
        public_id: randomPublicId,     // Use the random alphanumeric string as public_id
        overwrite: true,                // Ensure that if the file exists, it gets replaced
        folder: 'folders/documents',    // Specify the Cloudinary folder path
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        // Here, Cloudinary will store the file in the folder, but the public_id won't have 'folders/documents/'
        resolve({
          url: result.secure_url,       // URL of the uploaded file
          public_id: result.public_id.split('/').pop(),  // Remove the folder part from public_id
          fileName: fileName            // Include the original file name
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