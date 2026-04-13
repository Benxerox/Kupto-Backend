const {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  cloudinaryUploadFile,
  cloudinaryDeleteFile,
  cloudinaryDownloadFile,
} = require("../utils/cloudinary");

const fs = require("fs");
const asyncHandler = require("express-async-handler");

/* =========================
   HELPERS
========================= */
const normalizeDocPublicId = (idOrPublicId = "") => {
  const raw = String(idOrPublicId || "").trim();
  if (!raw) return "";

  // decode values like folders%2Fdocuments%2Ffile-name
  const val = decodeURIComponent(raw);

  // ✅ if client already sends a full public_id, keep it
  if (val.includes("/")) return val;

  // ✅ fallback for old clients that only send the base id
  return `folders/documents/${val}`;
};

/* =========================
   UPLOAD IMAGES
========================= */
const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    return res
      .status(400)
      .json({ message: "No files uploaded. Please upload at least one image." });
  }

  // ✅ allow WEBP too
  const validImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  const invalidFiles = files.filter(
    (file) => !validImageTypes.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    return res.status(400).json({
      message:
        "Invalid file type. Only image files (JPEG, PNG, GIF, WEBP) are allowed.",
    });
  }

  try {
    const uploadPromises = files.map(async (file) => {
      const { url, public_id } = await cloudinaryUploadImg(
        file.buffer,
        file.originalname
      );
      return { url, public_id };
    });

    const uploadedImages = await Promise.all(uploadPromises);
    res.json({ uploadedImages });
  } catch (error) {
    console.error("Error during image upload:", error);
    res.status(500).json({
      message: "Failed to upload images.",
      error: error.message || "Unknown error occurred.",
    });
  }
});

/* =========================
   DELETE IMAGE
========================= */
const deleteImages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "No image id provided." });
  }

  try {
    const result = await cloudinaryDeleteImg(id, "image");

    if (result?.result === "ok") {
      return res.json({ message: "Image deleted successfully" });
    }

    return res
      .status(404)
      .json({ message: "Image not found or could not be deleted" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return res.status(500).json({
      message: "Failed to delete image.",
      error: error.message,
    });
  }
});

/* =========================
   UPLOAD FILES (PDF/DOCS)
========================= */
const uploadFiles = asyncHandler(async (req, res) => {
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  try {
    const uploadPromises = files.map(async (file) => {
      const filePath = file.path;
      const fileName = file.originalname;

      const { url, public_id } = await cloudinaryUploadFile(filePath, fileName);

      // ✅ cleanup local upload
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkErr) {
        console.warn("Failed to delete local uploaded file:", unlinkErr.message);
      }

      // ✅ return the real cloudinary public_id
      return { url, public_id, fileName };
    });

    const uploadedFiles = await Promise.all(uploadPromises);
    return res.json(uploadedFiles);
  } catch (error) {
    console.error("Error during file upload:", error);
    return res.status(500).json({
      message: "Failed to upload files",
      error: error.message,
    });
  }
});

/* =========================
   DELETE FILE
   ✅ Accepts either:
   - full public_id: folders/documents/company-profile-v2
   - encoded public_id: folders%2Fdocuments%2Fcompany-profile-v2
   - or just base id: company-profile-v2
========================= */
const deleteFile = asyncHandler(async (req, res) => {
  const resourceType = req.query.resource_type || "raw";
  const publicId = normalizeDocPublicId(req.params.id);

  if (!publicId) {
    return res.status(400).json({ message: "No file id provided." });
  }

  try {
    const result = await cloudinaryDeleteFile(publicId, resourceType);

    if (result?.result === "ok") {
      return res.json({
        message: "File deleted successfully",
        public_id: publicId,
      });
    }

    return res.status(404).json({
      message: "File not found or could not be deleted",
      public_id: publicId,
    });
  } catch (error) {
    console.error("Error deleting file:", error);
    return res.status(500).json({
      message: "Failed to delete file",
      error: error.message,
      public_id: publicId,
    });
  }
});

/* =========================
   DOWNLOAD FILE
   ✅ Accepts either:
   - full public_id: folders/documents/company-profile-v2
   - encoded public_id: folders%2Fdocuments%2Fcompany-profile-v2
   - or just base id: company-profile-v2
========================= */
const downloadFile = asyncHandler(async (req, res) => {
  const resourceType = req.query.resource_type || "raw";
  const publicId = normalizeDocPublicId(req.params.id);

  if (!publicId) {
    return res.status(400).json({ message: "No file id provided." });
  }

  try {
    const fileUrl = await cloudinaryDownloadFile(publicId, resourceType);

    if (!fileUrl) {
      return res.status(404).json({
        message: "Download URL not found for this file",
        public_id: publicId,
      });
    }

    return res.redirect(fileUrl);
  } catch (error) {
    console.error("Error during file download:", error);
    return res.status(500).json({
      message: "Failed to download file",
      error: error.message,
      public_id: publicId,
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