// src/controllers/gallery.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";
import { CloudinaryUtil } from "../utils/cloudinary.util";
import slugify from "slugify";
import sharp from "sharp";

export class GalleryController {
  // Helper function to compress image
  private static async compressImage(buffer: Buffer): Promise<Buffer> {
    try {
      const metadata = await sharp(buffer).metadata();
      const fileSizeKB = buffer.length / 1024;
      console.log(
        `Compressing image: ${metadata.width}x${
          metadata.height
        }, ${fileSizeKB.toFixed(2)} KB`
      ); // Determine compression settings based on size

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
        `Compressed to ${compressedSizeKB.toFixed(
          2
        )} KB (${reduction}% smaller)`
      );

      return compressed;
    } catch (error) {
      console.error("Compression failed, using original:", error);
      return buffer;
    }
  } // Get all albums with images

  static async getAllAlbums(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where = search
        ? {
            OR: [
              {
                name: {
                  contains: search as string,
                  mode: "insensitive" as any,
                },
              },
              {
                description: {
                  contains: search as string,
                  mode: "insensitive" as any,
                },
              },
            ],
          }
        : {};

      const [albums, total] = await Promise.all([
        prisma.album.findMany({
          where,
          include: {
            images: {
              take: 5,
              orderBy: { uploadedAt: "desc" },
            },
            _count: {
              select: { images: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.album.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: albums,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Get albums error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch albums",
      });
    }
  } // Get single album by ID

  static async getAlbumById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const album = await prisma.album.findUnique({
        where: { id },
        include: {
          images: {
            orderBy: { uploadedAt: "desc" },
          },
          _count: {
            select: { images: true },
          },
        },
      });

      if (!album) {
        return res.status(404).json({
          success: false,
          message: "Album not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: album,
      });
    } catch (error) {
      console.error("Get album error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch album",
      });
    }
  } // Create new album (Admin only)

  static async createAlbum(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Album name is required",
        });
      }

      let coverImageUrl = null; // Upload cover image if provided

      if (req.file) {
        try {
          console.log("Uploading album cover image...");
          const result = await CloudinaryUtil.uploadImage(req.file.buffer, {
            folder: "bitsa/albums/covers",
            transformation: [
              { width: 800, height: 600, crop: "fill", quality: "auto:low" },
            ],
          });
          coverImageUrl = result.secure_url;
          console.log("Album cover uploaded:", coverImageUrl);
        } catch (uploadError) {
          console.error("Cover image upload failed:", uploadError);
          return res.status(500).json({
            success: false,
            message: "Failed to upload cover image",
          });
        }
      }

      const album = await prisma.album.create({
        data: {
          name,
          description,
          coverImage: coverImageUrl,
        },
        include: {
          _count: {
            select: { images: true },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: "Album created successfully",
        data: album,
      });
    } catch (error) {
      console.error("Create album error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create album",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Update album (Admin only)

  static async updateAlbum(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const album = await prisma.album.findUnique({ where: { id } });

      if (!album) {
        return res.status(404).json({
          success: false,
          message: "Album not found",
        });
      }

      let coverImageUrl = album.coverImage; // Upload new cover image if provided

      if (req.file) {
        try {
          // Delete old cover image from Cloudinary if exists
          if (album.coverImage) {
            console.log("Deleting old cover image...");
            await CloudinaryUtil.deleteImage(album.coverImage);
          }

          console.log("Uploading new cover image...");
          const result = await CloudinaryUtil.uploadImage(req.file.buffer, {
            folder: "bitsa/albums/covers",
            transformation: [
              { width: 800, height: 600, crop: "fill", quality: "auto:low" },
            ],
          });
          coverImageUrl = result.secure_url;
          console.log("New cover uploaded:", coverImageUrl);
        } catch (uploadError) {
          console.error("Cover image update failed:", uploadError);
          return res.status(500).json({
            success: false,
            message: "Failed to update cover image",
          });
        }
      }

      const updatedAlbum = await prisma.album.update({
        where: { id },
        data: {
          name: name || album.name,
          description:
            description !== undefined ? description : album.description,
          coverImage: coverImageUrl,
        },
        include: {
          _count: {
            select: { images: true },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Album updated successfully",
        data: updatedAlbum,
      });
    } catch (error) {
      console.error("Update album error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update album",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Delete album (Admin only)

  static async deleteAlbum(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const album = await prisma.album.findUnique({
        where: { id },
        include: { images: true },
      });

      if (!album) {
        return res.status(404).json({
          success: false,
          message: "Album not found",
        });
      }

      try {
        // Delete cover image from Cloudinary if exists
        if (album.coverImage) {
          console.log("Deleting album cover image...");
          await CloudinaryUtil.deleteImage(album.coverImage);
        } // Delete all album images from Cloudinary

        console.log(
          `Deleting ${album.images.length} images from Cloudinary...`
        );
        for (const image of album.images) {
          await CloudinaryUtil.deleteImage(image.imageUrl);
        }
        console.log("All images deleted successfully");
      } catch (cloudinaryError) {
        console.error("Cloudinary deletion error:", cloudinaryError); // Continue with database deletion even if Cloudinary fails
      } // Delete album and all associated images from database

      await prisma.album.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: "Album deleted successfully",
      });
    } catch (error) {
      console.error("Delete album error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete album",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Upload images to album (Admin only) - UPDATED VERSION

  static async uploadImages(req: Request, res: Response) {
    try {
      const { albumId, eventId } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No images provided",
        });
      } // Verify album exists if albumId provided

      if (albumId) {
        const album = await prisma.album.findUnique({ where: { id: albumId } });
        if (!album) {
          return res.status(404).json({
            success: false,
            message: "Album not found",
          });
        }
      } // Verify event exists if eventId provided

      if (eventId) {
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
          return res.status(404).json({
            success: false,
            message: "Event not found",
          });
        }
      }

      const uploadResults: any[] = [];
      const uploadErrors: any[] = []; // Upload images sequentially

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        try {
          console.log(
            `\n[${index + 1}/${files.length}] Processing: ${file.originalname}`
          ); // Compress image before upload
          const compressedBuffer = await GalleryController.compressImage(
            file.buffer
          ); // Retry logic
          let uploadResult = null;
          let retries = 3;
          while (retries > 0 && !uploadResult) {
            try {
              console.log(
                `Attempt ${4 - retries}/3 - Uploading to Cloudinary...`
              );
              uploadResult = await CloudinaryUtil.uploadImage(
                compressedBuffer,
                {
                  folder: "bitsa/gallery",
                  transformation: [
                    {
                      quality: "auto:good",
                      fetch_format: "auto",
                    },
                  ],
                }
              );
              console.log(`✓ Upload successful: ${uploadResult.secure_url}`); // Create database record
              const dbImage = await prisma.galleryImage.create({
                data: {
                  title:
                    req.body[`title_${index}`] ||
                    file.originalname.replace(/\.[^/.]+$/, ""),
                  description: req.body[`description_${index}`] || null,
                  imageUrl: uploadResult.secure_url,
                  albumId: albumId || null,
                  eventId: eventId || null,
                },
              });
              uploadResults.push(dbImage);
            } catch (retryError: any) {
              retries--;
              console.error(`✗ Attempt failed:`, retryError.message);
              if (retries > 0) {
                console.log(`Waiting 3 seconds before retry...`);
                await new Promise((resolve) => setTimeout(resolve, 3000));
              } else {
                throw retryError;
              }
            }
          }
        } catch (uploadError: any) {
          console.error(
            `✗ Failed to upload ${file.originalname}:`,
            uploadError.message
          );
          uploadErrors.push({
            index: index + 1,
            filename: file.originalname,
            error: uploadError.message || "Upload failed",
          });
        }
      }

      console.log(
        `\nUpload complete: ${uploadResults.length} success, ${uploadErrors.length} failed`
      ); // Return results

      if (uploadResults.length === 0) {
        return res.status(500).json({
          success: false,
          message: "All uploads failed",
          errors: uploadErrors,
        });
      }

      if (uploadErrors.length > 0) {
        return res.status(207).json({
          success: true,
          message: `${uploadResults.length} of ${files.length} image(s) uploaded successfully`,
          data: uploadResults,
          errors: uploadErrors,
        });
      }

      return res.status(201).json({
        success: true,
        message: `${uploadResults.length} image(s) uploaded successfully`,
        data: uploadResults,
      });
    } catch (error) {
      console.error("Upload images error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to upload images",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Get all gallery images with filters

  static async getAllImages(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, albumId, eventId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (albumId) where.albumId = albumId as string;
      if (eventId) where.eventId = eventId as string;

      const [images, total] = await Promise.all([
        prisma.galleryImage.findMany({
          where,
          include: {
            album: {
              select: {
                id: true,
                name: true,
              },
            },
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
              },
            },
          },
          orderBy: { uploadedAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.galleryImage.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: images,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Get images error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch images",
      });
    }
  } // Get single image by ID

  static async getImageById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const image = await prisma.galleryImage.findUnique({
        where: { id },
        include: {
          album: {
            select: {
              id: true,
              name: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
            },
          },
        },
      });

      if (!image) {
        return res.status(404).json({
          success: false,
          message: "Image not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: image,
      });
    } catch (error) {
      console.error("Get image error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch image",
      });
    }
  } // Update image details (Admin only)

  static async updateImage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, albumId, eventId } = req.body;

      const image = await prisma.galleryImage.findUnique({ where: { id } });

      if (!image) {
        return res.status(404).json({
          success: false,
          message: "Image not found",
        });
      }

      const updatedImage = await prisma.galleryImage.update({
        where: { id },
        data: {
          title: title || image.title,
          description:
            description !== undefined ? description : image.description,
          albumId: albumId !== undefined ? albumId : image.albumId,
          eventId: eventId !== undefined ? eventId : image.eventId,
        },
        include: {
          album: {
            select: {
              id: true,
              name: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Image updated successfully",
        data: updatedImage,
      });
    } catch (error) {
      console.error("Update image error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update image",
      });
    }
  } // Delete image (Admin only)

  static async deleteImage(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const image = await prisma.galleryImage.findUnique({ where: { id } });

      if (!image) {
        return res.status(404).json({
          success: false,
          message: "Image not found",
        });
      }

      try {
        // Delete from Cloudinary
        console.log("Deleting image from Cloudinary...");
        await CloudinaryUtil.deleteImage(image.imageUrl);
        console.log("Image deleted from Cloudinary");
      } catch (cloudinaryError) {
        console.error("Cloudinary deletion error:", cloudinaryError); // Continue with database deletion even if Cloudinary fails
      } // Delete from database

      await prisma.galleryImage.delete({ where: { id } });

      return res.status(200).json({
        success: true,
        message: "Image deleted successfully",
      });
    } catch (error) {
      console.error("Delete image error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete image",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Bulk delete images (Admin only)

  static async bulkDeleteImages(req: Request, res: Response) {
    try {
      const { imageIds } = req.body;

      if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Image IDs array is required",
        });
      }

      const images = await prisma.galleryImage.findMany({
        where: { id: { in: imageIds } },
      });

      if (images.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No images found",
        });
      }

      try {
        // Delete from Cloudinary
        console.log(`Bulk deleting ${images.length} images from Cloudinary...`);
        await Promise.all(
          images.map((image) => CloudinaryUtil.deleteImage(image.imageUrl))
        );
        console.log("All images deleted from Cloudinary");
      } catch (cloudinaryError) {
        console.error("Cloudinary bulk deletion error:", cloudinaryError); // Continue with database deletion even if Cloudinary fails
      } // Delete from database

      await prisma.galleryImage.deleteMany({
        where: { id: { in: imageIds } },
      });

      return res.status(200).json({
        success: true,
        message: `${images.length} image(s) deleted successfully`,
      });
    } catch (error) {
      console.error("Bulk delete images error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete images",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  } // Get images by event

  static async getImagesByEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      const [images, total] = await Promise.all([
        prisma.galleryImage.findMany({
          where: { eventId },
          include: {
            album: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { uploadedAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.galleryImage.count({ where: { eventId } }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          event: {
            id: event.id,
            title: event.title,
            startDate: event.startDate,
          },
          images,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      console.error("Get event images error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch event images",
      });
    }
  }
}
