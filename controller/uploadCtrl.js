<<<<<<< HEAD
=======

>>>>>>> 220a54418c24e5c1f12a33f4ad339f9df4094950
const { cloudinaryUploadImg, cloudinaryDeleteImg, cloudinaryUploadFile, cloudinaryDeleteFile, cloudinaryDownloadFile } = require('../utils/cloudinary');
const fs = require('fs');
const asyncHandler = require('express-async-handler');

// Upload images
const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded. Please upload at least one image.' });
  }

  // Validating file types (only allow images)
  const validImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const invalidFiles = files.filter(file => !validImageTypes.includes(file.mimetype));

  if (invalidFiles.length > 0) {
    return res.status(400).json({
      message: 'Invalid file type. Only image files (JPEG, PNG, GIF) are allowed.',
    });
  }

  const uploader = (file) => cloudinaryUploadImg(file.buffer, file.originalname); // Include original filename
  const uploadedImages = [];

  try {
    const uploadPromises = files.map(async (file) => {
      const { url, public_id } = await uploader(file); // Upload directly to Cloudinary
      return { url, public_id };
    });

    uploadedImages.push(...await Promise.all(uploadPromises));
    res.json({ uploadedImages });
  } catch (error) {
    console.error('Error during image upload:', error);
    res.status(500).json({
      message: 'Failed to upload images.',
      error: error.message || 'Unknown error occurred.',
    });
  }
});


// Delete image
const deleteImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: 'No image id provided.' });
  }

  try {
    const result = await cloudinaryDeleteImg(id, 'image');
    
    if (result && result.result === 'ok') {
      return res.json({ message: 'Image deleted successfully' });
    }

    res.status(404).json({ message: 'Image not found or could not be deleted' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Failed to delete image.', error: error.message });
  }
});

// Upload files
const uploadFiles = asyncHandler(async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ message: 'No files uploaded' });
  }

  const uploadPromises = files.map(async (file) => {
    const filePath = file.path;
    const fileName = file.originalname;
    const { url, public_id } = await cloudinaryUploadFile(filePath, fileName);
    await fs.promises.unlink(filePath); // Cleanup local file after upload
    return { url, public_id, fileName };
  });

  try {
    const uploadedFiles = await Promise.all(uploadPromises);
    res.json(uploadedFiles); // Send response with the uploaded file info
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: 'Failed to upload files', error: error.message });
  }
});

// Delete file
const deleteFile = asyncHandler(async (req, res) => {
  const publicId = `folders/documents/${req.params.id}`;  // Add the folder path to the public_id
  const resourceType = req.query.resource_type || 'raw';  // Default to 'raw' if not provided

  try {
    // Attempt to delete the file from Cloudinary
    const result = await cloudinaryDeleteFile(publicId, resourceType);

    if (result.result === 'ok') {
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ message: 'File not found or could not be deleted' });
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
});

const downloadFile = asyncHandler(async (req, res) => {
  const { id } = req.params;  // Extract the file ID from the URL parameter
  const resourceType = req.query.resource_type || 'raw';  // Default to 'raw' if not specified

  // Construct the Cloudinary public ID based on the path
  const publicId = `folders/documents/${id}`;  // e.g., "folders/documents/ojnul8uxwfd.pdf"

  try {
    // Fetch the download URL from Cloudinary
    const fileUrl = await cloudinaryDownloadFile(publicId, resourceType);

    // Redirect to the Cloudinary URL (user will be redirected to download the file)
    res.redirect(fileUrl);  // This will redirect the user to the file URL for download
  } catch (error) {
    console.error('Error during file download:', error);

    // Send an error response in case of failure
    res.status(500).json({
      message: 'Failed to download file',
      error: error.message
    });
  }
});

module.exports = {
  uploadImages,
  deleteImages,
  uploadFiles,
  deleteFile,
  downloadFile,
};