const { cloudinaryUploadImg, cloudinaryDeleteImg, cloudinaryUploadFile, cloudinaryDeleteFile } = require('../utils/cloudinary');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('express-async-handler');

// Upload images
const uploadImages = asyncHandler(async (req, res) => {
  const uploader = (file) => cloudinaryUploadImg(file.path);
  const urls = [];
  const files = req.files;
  console.log('Files:', files);

  try {
    for (const file of files) {
      const { url, public_id } = await uploader(file); // Upload directly to Cloudinary
      console.log({ url, public_id });
      urls.push({ url, public_id });

      // Delete local file if saved locally (optional)
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error('Failed to delete local file:', file.path, err);
        } else {
          console.log('Local file deleted:', file.path);
        }
      });
    }

    res.json(urls);
  } catch (error) {
    console.error('Error during image upload:', error);
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
});

// Delete image
const deleteImages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    const result = await cloudinaryDeleteImg(id, 'image');
    if (result.result === 'ok') {
      res.json({ message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ message: 'Image not found or could not be deleted' });
    }
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image', error: error.message });
  }
});

// Handle file uploads
const uploadFiles = asyncHandler(async (req, res) => {
  const urls = [];
  const files = req.files;

  for (const file of files) {
    const filePath = file.path;
    const fileName = file.originalname;
    
    // Use fileName as the public_id (excluding extension)
    const { url, public_id } = await cloudinaryUploadFile(filePath, fileName);

    urls.push({ url, public_id, fileName });

    // Optionally delete the local file after upload
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', filePath, err);
    });
  }

  res.json(urls);
});

// Handle file deletion
const deleteFile = async (req, res) => {
  const { id } = req.params; // Get the public ID from the request parameters

  try {
    // Call your cloudinaryDeleteFile function with the public ID
    const result = await cloudinaryDeleteFile(id);
    res.json({ message: 'File deleted successfully', result });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
};

module.exports = {
  uploadImages,
  deleteImages,
  uploadFiles,
  deleteFile
};