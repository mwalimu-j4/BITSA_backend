// src/routes/student-settings.routes.ts
import express from "express";
import { StudentSettingsController } from "../controllers/student-settings.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";
import multer from "multer";

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// All routes require authentication
router.use(AuthMiddleware.authenticate);

/**
 * @route   GET /api/student/profile
 * @desc    Get current user's profile
 * @access  Private (Student only)
 */
router.get("/profile", StudentSettingsController.getProfile);

/**
 * @route   PUT /api/student/profile
 * @desc    Update user profile
 * @access  Private (Student only)
 */
router.put("/profile", StudentSettingsController.updateProfile);

/**
 * @route   PUT /api/student/profile/image
 * @desc    Update profile image
 * @access  Private (Student only)
 */
router.put(
  "/profile/image",
  upload.single("image"),
  StudentSettingsController.updateProfileImage
);

/**
 * @route   PUT /api/student/password
 * @desc    Change password
 * @access  Private (Student only)
 */
router.put("/password", StudentSettingsController.changePassword);

/**
 * @route   GET /api/student/notifications/preferences
 * @desc    Get notification preferences
 * @access  Private (Student only)
 */
router.get(
  "/notifications/preferences",
  StudentSettingsController.getNotificationPreferences
);

/**
 * @route   PUT /api/student/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private (Student only)
 */
router.put(
  "/notifications/preferences",
  StudentSettingsController.updateNotificationPreferences
);

/**
 * @route   DELETE /api/student/account
 * @desc    Delete account (soft delete)
 * @access  Private (Student only)
 */
router.delete("/account", StudentSettingsController.deleteAccount);

export default router;
