// src/routes/gallery.routes.ts
import { Router } from "express";
import { GalleryController } from "../controllers/gallery.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Get all albums (public view)
router.get("/albums", GalleryController.getAllAlbums);

// Get single album by ID
router.get("/albums/:id", GalleryController.getAlbumById);

// Get all gallery images with filters
router.get("/images", GalleryController.getAllImages);

// Get single image by ID
router.get("/images/:id", GalleryController.getImageById);

// Get images by event
router.get("/events/:eventId/images", GalleryController.getImagesByEvent);

// ============================================
// ADMIN ONLY ROUTES
// ============================================

// Album Management
router.post(
  "/albums",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  upload.single("coverImage"),
  GalleryController.createAlbum
);

router.put(
  "/albums/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  upload.single("coverImage"),
  GalleryController.updateAlbum
);

router.delete(
  "/albums/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  GalleryController.deleteAlbum
);

// Image Management
router.post(
  "/images/upload",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  upload.array("images", 20), // Max 20 images at once
  GalleryController.uploadImages
);

router.put(
  "/images/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  GalleryController.updateImage
);

router.delete(
  "/images/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  GalleryController.deleteImage
);

router.post(
  "/images/bulk-delete",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  GalleryController.bulkDeleteImages
);

export default router;
