const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");
const path = require("path"); // ✅ REQUIRED
const slugify = require("slugify"); // ✅ optional but recommended

// Function to generate a random 24-character alphanumeric public_id
function generateRandomId() {
  return crypto.randomBytes(12).toString("hex");
}

// Configuring Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.SECRET_KEY,
});

/* =========================
   IMAGE UPLOAD
========================= */
const cloudinaryUploadImg = (file, fileName, resourceType = "image") => {
  return new Promise((resolve, reject) => {
    const randomPublicId = generateRandomId();

    const uploadParams = {
      resource_type: resourceType,
      public_id: randomPublicId,
      overwrite: true,
      folder: "images",
      upload_preset: "original_images", // keeps original dimensions (no forced crop)
    };

    cloudinary.uploader
      .upload_stream(uploadParams, (error, result) => {
        if (error) {
          console.error(`Cloudinary upload error for file ${fileName}:`, error);
          return reject(
            new Error(`Failed to upload file ${fileName}: ${error.message}`)
          );
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          fileName,
        });
      })
      .end(file);
  });
};

/* =========================
   IMAGE DELETE
========================= */
const cloudinaryDeleteImg = (publicId, resourceType = "image") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          console.error(`Cloudinary delete error for public_id ${publicId}:`, error);
          return reject(
            new Error(
              `Failed to delete image with public_id ${publicId}: ${error.message}`
            )
          );
        }
        resolve(result);
      }
    );
  });
};

/* =========================
   FILE UPLOAD (PDF/DOCS)
   ✅ Keeps original name
========================= */
const cloudinaryUploadFile = (filePath, fileName, resourceType = "raw") => {
  return new Promise((resolve, reject) => {
    // "Company Profile v2.pdf" -> "Company Profile v2"
    const baseName = path.parse(fileName).name;

    // ✅ clean it for a safe public_id
    const safeName = slugify(baseName, { lower: true, strict: true, trim: true });

    cloudinary.uploader.upload(
      filePath,
      {
        resource_type: resourceType, // raw for pdf/docs
        folder: "folders/documents",

        // ✅ keep original name (cleaned)
        public_id: safeName,

        // ✅ prevent Cloudinary from adding random suffix
        unique_filename: false,

        // ✅ overwrite if same name uploaded again
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id, // folders/documents/company-profile-v2
          fileName,
        });
      }
    );
  });
};

/* =========================
   FILE DELETE
========================= */
const cloudinaryDeleteFile = (publicId, resourceType = "raw") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
  });
};

/* =========================
   FILE DOWNLOAD URL
========================= */
const cloudinaryDownloadFile = (publicId, resourceType = "raw") => {
  return new Promise((resolve, reject) => {
    try {
      const fileUrl = cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
      });
      resolve(fileUrl);
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
