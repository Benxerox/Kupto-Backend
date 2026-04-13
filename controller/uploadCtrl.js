const {
  cloudinaryUploadImg,
  cloudinaryDeleteImg,
  cloudinaryUploadFile,
  cloudinaryDeleteFile,
  cloudinaryDownloadFile,
} = require("../utils/cloudinary");

const fs = require("fs");
const axios = require("axios");
const asyncHandler = require("express-async-handler");

/* =========================
   HELPERS
========================= */
const normalizeDocPublicId = (idOrPublicId = "") => {
  const raw = String(idOrPublicId || "").trim();
  if (!raw) return "";

  const val = decodeURIComponent(raw);

  // if full public_id is sent, keep it
  if (val.includes("/")) return val;

  // fallback for older requests
  return `folders/documents/${val}`;
};

const getSafeDownloadName = (name = "", fallback = "downloaded-file") => {
  const raw = String(name || "").trim();
  if (!raw) return fallback;

  return raw.replace(/[/\\?%*:|"<>]/g, "_");
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
    return res.json({ uploadedImages });
  } catch (error) {
    console.error("Error during image upload:", error);
    return res.status(500).json({
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

      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkErr) {
        console.warn("Failed to delete local uploaded file:", unlinkErr.message);
      }

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
   streams through backend so filename stays exact
========================= */
const downloadFile = asyncHandler(async (req, res) => {
  const resourceType = req.query.resource_type || "raw";
  const publicId = normalizeDocPublicId(req.params.id);
  const requestedFileName = getSafeDownloadName(
    req.query.fileName,
    publicId.split("/").pop() || "downloaded-file"
  );

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

    const response = await axios.get(fileUrl, {
      responseType: "stream",
    });

    const contentType =
      response.headers["content-type"] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${requestedFileName}"`
    );

    return response.data.pipe(res);
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