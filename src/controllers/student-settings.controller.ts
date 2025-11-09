// src/controllers/student-settings.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";
import bcrypt from "bcryptjs";
import { CloudinaryUtil } from "../utils/cloudinary.util";

export class StudentSettingsController {
  /**
   * Get student profile
   * GET /api/student/profile
   */
  static async getProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          studentId: true,
          name: true,
          email: true,
          phone: true,
          course: true,
          yearOfStudy: true,
          bio: true,
          image: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch profile",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update student profile
   * PUT /api/student/profile
   */
  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      const { name, email, phone, course, yearOfStudy, bio } = req.body;

      // Verify user owns this profile
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if email is already taken by another user
      if (email && email !== user.email) {
        const emailExists = await prisma.user.findFirst({
          where: {
            email,
            id: { not: userId },
          },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "Email already in use by another account",
          });
        }
      }

      // Check if phone is already taken by another user
      if (phone && phone !== user.phone) {
        const phoneExists = await prisma.user.findFirst({
          where: {
            phone,
            id: { not: userId },
          },
        });

        if (phoneExists) {
          return res.status(400).json({
            success: false,
            message: "Phone number already in use by another account",
          });
        }
      }

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: name || user.name,
          email: email || user.email,
          phone: phone || user.phone,
          course: course !== undefined ? course : user.course,
          yearOfStudy:
            yearOfStudy !== undefined
              ? parseInt(yearOfStudy)
              : user.yearOfStudy,
          bio: bio !== undefined ? bio : user.bio,
        },
        select: {
          id: true,
          studentId: true,
          name: true,
          email: true,
          phone: true,
          course: true,
          yearOfStudy: true,
          bio: true,
          image: true,
          role: true,
          emailVerified: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update profile",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update profile image
   * PUT /api/student/profile/image
   */
  static async updateProfileImage(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      try {
        // Delete old image from Cloudinary if exists
        if (user.image) {
          console.log("Deleting old profile image...");
          await CloudinaryUtil.deleteImage(user.image);
        }

        // Upload new image
        console.log("Uploading new profile image...");
        const result = await CloudinaryUtil.uploadImage(req.file.buffer, {
          folder: "bitsa/profiles",
          transformation: [
            {
              width: 400,
              height: 400,
              crop: "fill",
              gravity: "face",
              quality: "auto:good",
            },
          ],
        });

        // Update user with new image URL
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { image: result.secure_url },
          select: {
            id: true,
            studentId: true,
            name: true,
            image: true,
          },
        });

        return res.status(200).json({
          success: true,
          message: "Profile image updated successfully",
          data: {
            image: updatedUser.image,
          },
        });
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload profile image",
        });
      }
    } catch (error) {
      console.error("Update profile image error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update profile image",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Change password
   * PUT /api/student/password
   */
  static async changePassword(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "All password fields are required",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "New passwords do not match",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "PASSWORD_CHANGED",
          entity: "User",
          entityId: userId,
          description: "User changed their password",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to change password",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get notification preferences
   * GET /api/student/notifications/preferences
   */
  static async getNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      // Get preferences from settings table
      const preferences = await prisma.setting.findMany({
        where: {
          key: {
            in: [
              `user:${userId}:notifications:email`,
              `user:${userId}:notifications:events`,
              `user:${userId}:notifications:blogs`,
              `user:${userId}:notifications:announcements`,
            ],
          },
        },
      });

      // Parse preferences
      const settings = {
        emailNotifications: true,
        eventReminders: true,
        blogUpdates: true,
        announcements: true,
      };

      preferences.forEach((pref) => {
        if (pref.key === `user:${userId}:notifications:email`) {
          settings.emailNotifications = pref.value === "true";
        } else if (pref.key === `user:${userId}:notifications:events`) {
          settings.eventReminders = pref.value === "true";
        } else if (pref.key === `user:${userId}:notifications:blogs`) {
          settings.blogUpdates = pref.value === "true";
        } else if (pref.key === `user:${userId}:notifications:announcements`) {
          settings.announcements = pref.value === "true";
        }
      });

      return res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error("Get notification preferences error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch notification preferences",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Update notification preferences
   * PUT /api/student/notifications/preferences
   */
  static async updateNotificationPreferences(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      const { emailNotifications, eventReminders, blogUpdates, announcements } =
        req.body;

      // Update or create settings
      const updates = [
        {
          key: `user:${userId}:notifications:email`,
          value: String(emailNotifications !== false),
        },
        {
          key: `user:${userId}:notifications:events`,
          value: String(eventReminders !== false),
        },
        {
          key: `user:${userId}:notifications:blogs`,
          value: String(blogUpdates !== false),
        },
        {
          key: `user:${userId}:notifications:announcements`,
          value: String(announcements !== false),
        },
      ];

      await Promise.all(
        updates.map((setting) =>
          prisma.setting.upsert({
            where: { key: setting.key },
            update: { value: setting.value },
            create: {
              key: setting.key,
              value: setting.value,
            },
          })
        )
      );

      return res.status(200).json({
        success: true,
        message: "Notification preferences updated successfully",
        data: {
          emailNotifications: emailNotifications !== false,
          eventReminders: eventReminders !== false,
          blogUpdates: blogUpdates !== false,
          announcements: announcements !== false,
        },
      });
    } catch (error) {
      console.error("Update notification preferences error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update notification preferences",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Delete account (soft delete)
   * DELETE /api/student/account
   */
  static async deleteAccount(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      const { password } = req.body;

      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required to delete account",
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }

      // Soft delete - deactivate account
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
        },
      });

      // Delete all sessions
      await prisma.session.deleteMany({
        where: { userId },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId,
          action: "ACCOUNT_DELETED",
          entity: "User",
          entityId: userId,
          description: "User deleted their account",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        },
      });

      return res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      console.error("Delete account error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete account",
        error:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  }
}
