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
        public_id: randomPublicId,     // Only use randomPublicId without folder prefix
        overwrite: true,                // Ensure that if the file exists, it gets replaced
        folder: 'folders/documents',    // Specify the Cloudinary folder path
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve({
          url: result.secure_url,       // URL of the uploaded file
          public_id: result.public_id,  // Full public_id with folder path
          fileName: fileName            // Include the original file name
        });
      }
    );
  });
};

const cloudinaryDeleteFile = (publicId, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to delete file with public_id: ${publicId}`);

    cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (error, result) => {
      if (error) {
        console.error('Cloudinary delete error:', error);
        return reject(error);
      }

      // Check if the result indicates a successful deletion
      if (result.result === 'ok') {
        console.log(`File ${publicId} deleted successfully`);
        resolve(result);
      } else {
        console.error(`File ${publicId} could not be deleted. Result:`, result);
        reject(new Error('File not found or could not be deleted'));
      }
    });
  });
};
const cloudinaryDownloadFile = (publicId, resourceType = 'raw') => {
  return new Promise((resolve, reject) => {
    try {
      const options = {
        resource_type: resourceType,
        secure: true,  // Always use HTTPS
      };

      // Since the file is public, generate the public URL directly
      const fileUrl = cloudinary.url(publicId, options);
      resolve(fileUrl);  // Return the generated public URL
    } catch (error) {
      reject(new Error(`Failed to generate URL for ${publicId}: ${error.message}`));
    }
  });
};

module.exports = {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  cloudinaryUploadFile,
  cloudinaryDeleteFile,
  cloudinaryDownloadFile,
};