import path from "path";
import cloudinary from "../config/cloudinary.js";

export const uploadBufferToCloudinary = (
  file,
  folder = "uploads",
  resourceType = "auto",
) =>
  new Promise((resolve, reject) => {
    const baseName = path.parse(file.originalname || "file").name;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: baseName,
        use_filename: false,
        unique_filename: true,
        filename_override: file.originalname,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(file.buffer);
  });
