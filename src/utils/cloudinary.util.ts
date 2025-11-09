// src/utils/cloudinary.util.ts
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
}

interface UploadOptions {
  folder?: string;
  transformation?: any[];
  resource_type?: "image" | "video" | "raw" | "auto";
  public_id?: string;
}

export class CloudinaryUtil {
  private static isConfigured = false;

  static configure(config: CloudinaryConfig) {
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
      secure: true,
    });
    this.isConfigured = true;
  }

  static ensureConfigured() {
    if (!this.isConfigured) {
      this.configure({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
        api_key: process.env.CLOUDINARY_API_KEY || "",
        api_secret: process.env.CLOUDINARY_API_SECRET || "",
      });
    }
  }

  /**
   * Upload image to Cloudinary
   * @param fileBuffer - Buffer from multer
   * @param options - Upload options
   * @returns Upload result with secure_url
   */
  static async uploadImage(
    fileBuffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadApiResponse> {
    this.ensureConfigured();

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || "bitsa",
          transformation: options.transformation || [],
          resource_type: options.resource_type || "image",
          public_id: options.public_id,
        },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else if (result) {
            resolve(result);
          } else {
            reject(new Error("Upload failed with no result"));
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete image from Cloudinary
   * @param imageUrl - Full Cloudinary URL or public_id
   * @returns Deletion result
   */
  static async deleteImage(imageUrl: string): Promise<any> {
    this.ensureConfigured();

    try {
      // Extract public_id from URL
      const publicId = this.extractPublicId(imageUrl);

      if (!publicId) {
        throw new Error("Invalid image URL");
      }

      const result = await cloudinary.uploader.destroy(publicId);
      return result;
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      throw error;
    }
  }

  /**
   * Delete multiple images from Cloudinary
   * @param imageUrls - Array of Cloudinary URLs
   * @returns Array of deletion results
   */
  static async deleteMultipleImages(imageUrls: string[]): Promise<any[]> {
    this.ensureConfigured();

    const deletePromises = imageUrls.map((url) => this.deleteImage(url));
    return Promise.all(deletePromises);
  }

  /**
   * Extract public_id from Cloudinary URL
   * @param url - Cloudinary image URL
   * @returns public_id
   */
  private static extractPublicId(url: string): string | null {
    try {
      // Example URL: https://res.cloudinary.com/demo/image/upload/v1234567890/folder/image.jpg
      const parts = url.split("/upload/");
      if (parts.length < 2) return null;

      const pathParts = parts[1].split("/");
      // Remove version if present (starts with 'v' followed by numbers)
      const startIndex = pathParts[0].match(/^v\d+$/) ? 1 : 0;

      // Join remaining parts and remove file extension
      const publicIdWithExt = pathParts.slice(startIndex).join("/");
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");

      return publicId;
    } catch (error) {
      console.error("Error extracting public_id:", error);
      return null;
    }
  }

  /**
   * Get optimized image URL
   * @param publicId - Image public ID
   * @param transformations - Transformation options
   * @returns Optimized image URL
   */
  static getOptimizedUrl(publicId: string, transformations: any = {}): string {
    this.ensureConfigured();

    return cloudinary.url(publicId, {
      quality: "auto",
      fetch_format: "auto",
      ...transformations,
    });
  }

  /**
   * Generate thumbnail URL
   * @param imageUrl - Original image URL
   * @param width - Thumbnail width
   * @param height - Thumbnail height
   * @returns Thumbnail URL
   */
  static getThumbnailUrl(
    imageUrl: string,
    width: number = 300,
    height: number = 300
  ): string {
    const publicId = this.extractPublicId(imageUrl);
    if (!publicId) return imageUrl;

    return this.getOptimizedUrl(publicId, {
      width,
      height,
      crop: "fill",
      gravity: "auto",
    });
  }

  /**
   * Upload file from URL
   * @param url - Source URL
   * @param options - Upload options
   * @returns Upload result
   */
  static async uploadFromUrl(
    url: string,
    options: UploadOptions = {}
  ): Promise<UploadApiResponse> {
    this.ensureConfigured();

    try {
      const result = await cloudinary.uploader.upload(url, {
        folder: options.folder || "bitsa",
        transformation: options.transformation || [],
        resource_type: (options.resource_type || "image") as
          | "image"
          | "video"
          | "raw"
          | "auto",
      });

      return result;
    } catch (error) {
      console.error("Cloudinary upload from URL error:", error);
      throw error;
    }
  }

  /**
   * Get folder contents
   * @param folderPath - Cloudinary folder path
   * @returns List of resources in folder
   */
  static async getFolderContents(folderPath: string): Promise<any> {
    this.ensureConfigured();

    try {
      const result = await cloudinary.api.resources({
        type: "upload",
        prefix: folderPath,
        max_results: 500,
      });

      return result;
    } catch (error) {
      console.error("Cloudinary get folder error:", error);
      throw error;
    }
  }

  /**
   * Delete entire folder
   * @param folderPath - Cloudinary folder path
   * @returns Deletion result
   */
  static async deleteFolder(folderPath: string): Promise<any> {
    this.ensureConfigured();

    try {
      // Delete all resources in folder
      await cloudinary.api.delete_resources_by_prefix(folderPath);

      // Delete the folder itself
      const result = await cloudinary.api.delete_folder(folderPath);
      return result;
    } catch (error) {
      console.error("Cloudinary delete folder error:", error);
      throw error;
    }
  }
}
