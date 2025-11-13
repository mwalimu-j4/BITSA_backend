// src/routes/upload.routes.ts
import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { CloudinaryUtil } from "../utils/cloudinary.util";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// =============================
// Multer Configuration
// =============================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// =============================
// Image Compression Helper
// =============================
async function compressImage(buffer: Buffer): Promise<Buffer> {
  try {
    const metadata = await sharp(buffer).metadata();
    const fileSizeKB = buffer.length / 1024;

    console.log(
      `Compressing image: ${metadata.width}x${
        metadata.height
      }, ${fileSizeKB.toFixed(2)} KB`
    );

    let quality = 85;
    let maxWidth = 1920;

    if (fileSizeKB > 3000) {
      quality = 75;
      maxWidth = 1600;
    } else if (fileSizeKB > 1500) {
      quality = 80;
      maxWidth = 1800;
    }

    const compressed = await sharp(buffer)
      .resize(maxWidth, null, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toBuffer();

    const compressedSizeKB = compressed.length / 1024;
    const reduction = ((1 - compressedSizeKB / fileSizeKB) * 100).toFixed(1);

    console.log(
      `Compressed to ${compressedSizeKB.toFixed(2)} KB (${reduction}% smaller)`
    );

    return compressed;
  } catch (error) {
    console.error("Compression failed, using original:", error);
    return buffer;
  }
}

// =============================
// Role Authorization Helper
// =============================
// This ensures compatibility with authorize() expecting a single string
const authorizeRoles = (...roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
};

// =============================
// Upload Blog Cover Image Route
// =============================
router.post(
  "/blog-cover",
  AuthMiddleware.authenticate,
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      console.log("📤 Uploading blog cover image...");

      // Compress image
      const compressedBuffer = await compressImage(req.file.buffer);

      // Upload to Cloudinary
      const result = await CloudinaryUtil.uploadImage(compressedBuffer, {
        folder: "bitsa/blog-covers",
        transformation: [
          {
            width: 1200,
            height: 630,
            crop: "fill",
            quality: "auto:good",
            fetch_format: "auto",
          },
        ],
      });

      console.log("✅ Blog cover uploaded:", result.secure_url);

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          imageUrl: result.secure_url,
          publicId: result.public_id,
        },
      });
    } catch (error) {
      console.error("Upload blog cover error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }
);

export default router;
