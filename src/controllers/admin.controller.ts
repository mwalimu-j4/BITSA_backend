// src/controllers/admin.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";
import bcrypt from "bcryptjs";

export class AdminController {
  // Get all users with pagination and search
  static async getAllUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;
      const skip = (page - 1) * limit;
      const search = (req.query.search as string) || "";
      const role = req.query.role as string;
      const status = req.query.status as string;
      const verified = req.query.verified as string;

      // Build where clause
      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { studentId: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { course: { contains: search, mode: "insensitive" } },
        ];
      }

      if (role && role !== "all") {
        where.role = role;
      }

      if (status === "active") {
        where.isActive = true;
      } else if (status === "inactive") {
        where.isActive = false;
      }

      if (verified === "true") {
        where.emailVerified = true;
      } else if (verified === "false") {
        where.emailVerified = false;
      }

      // Get total count
      const total = await prisma.user.count({ where });

      // Get users
      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          email: true,
          phone: true,
          name: true,
          role: true,
          course: true,
          yearOfStudy: true,
          emailVerified: true,
          isActive: true,
          image: true,
          createdAt: true,
          lastLoginAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        },
      });
    } catch (error) {
      console.error("Get all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
      });
    }
  }

  // Get user statistics
  static async getUserStats(req: Request, res: Response) {
    try {
      const [
        total,
        active,
        inactive,
        verified,
        unverified,
        students,
        admins,
        superAdmins,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.user.count({ where: { emailVerified: true } }),
        prisma.user.count({ where: { emailVerified: false } }),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "ADMIN" } }),
        prisma.user.count({ where: { role: "SUPER_ADMIN" } }),
      ]);

      res.json({
        success: true,
        data: {
          total,
          active,
          inactive,
          verified,
          unverified,
          byRole: {
            STUDENT: students,
            ADMIN: admins,
            SUPER_ADMIN: superAdmins,
          },
        },
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch user statistics",
      });
    }
  }

  // Update user
  static async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, email, phone, course, yearOfStudy, studentId } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent modifying super admin if not super admin
      if (user.role === "SUPER_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can modify super admin accounts",
        });
      }

      // Check for unique constraints
      if (email && email !== user.email) {
        const emailExists = await prisma.user.findUnique({
          where: { email },
        });
        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "Email already in use",
          });
        }
      }

      if (phone && phone !== user.phone) {
        const phoneExists = await prisma.user.findUnique({
          where: { phone },
        });
        if (phoneExists) {
          return res.status(400).json({
            success: false,
            message: "Phone number already in use",
          });
        }
      }

      if (studentId && studentId !== user.studentId) {
        const studentIdExists = await prisma.user.findUnique({
          where: { studentId },
        });
        if (studentIdExists) {
          return res.status(400).json({
            success: false,
            message: "Student ID already in use",
          });
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          name,
          email,
          phone,
          course,
          yearOfStudy: yearOfStudy ? parseInt(yearOfStudy) : undefined,
          studentId,
        },
        select: {
          id: true,
          studentId: true,
          email: true,
          phone: true,
          name: true,
          role: true,
          course: true,
          yearOfStudy: true,
          emailVerified: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user",
      });
    }
  }

  // Delete user
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent deleting super admin
      if (user.role === "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Cannot delete super admin account",
        });
      }

      // Prevent self-deletion
      if (id === req.user?.id) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete your own account",
        });
      }

      await prisma.user.delete({ where: { id } });

      res.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete user",
      });
    }
  }

  // Toggle user active status
  static async toggleUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Prevent modifying super admin
      if (user.role === "SUPER_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Cannot modify super admin status",
        });
      }

      // Prevent self-deactivation
      if (id === req.user?.id) {
        return res.status(403).json({
          success: false,
          message: "Cannot deactivate your own account",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: `User ${
          updatedUser.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updatedUser,
      });
    } catch (error) {
      console.error("Toggle user status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to toggle user status",
      });
    }
  }

  // Update user role
  static async updateUserRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!["STUDENT", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role",
        });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Only SUPER_ADMIN can create other SUPER_ADMINs
      if (role === "SUPER_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can assign super admin role",
        });
      }

      // Prevent modifying super admin role
      if (user.role === "SUPER_ADMIN" && req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Cannot modify super admin role",
        });
      }

      // Prevent self-demotion
      if (id === req.user?.id) {
        return res.status(403).json({
          success: false,
          message: "Cannot modify your own role",
        });
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          name: true,
          role: true,
        },
      });

      res.json({
        success: true,
        message: "User role updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update user role",
      });
    }
  }

  // Verify all unverified users
  static async verifyAllUsers(req: Request, res: Response) {
    try {
      const result = await prisma.user.updateMany({
        where: { emailVerified: false },
        data: { emailVerified: true },
      });

      res.json({
        success: true,
        message: `${result.count} user(s) verified successfully`,
        data: { count: result.count },
      });
    } catch (error) {
      console.error("Verify all users error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify users",
      });
    }
  }

  // Get auto-verify setting
  static async getAutoVerifySetting(req: Request, res: Response) {
    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "auto_verify_users" },
      });

      res.json({
        success: true,
        data: {
          autoVerify: setting?.value === "true" || false,
        },
      });
    } catch (error) {
      console.error("Get auto-verify setting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch setting",
      });
    }
  }

  // Update auto-verify setting
  static async updateAutoVerifySetting(req: Request, res: Response) {
    try {
      const { autoVerify } = req.body;

      if (typeof autoVerify !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "autoVerify must be a boolean",
        });
      }

      const setting = await prisma.setting.upsert({
        where: { key: "auto_verify_users" },
        update: { value: autoVerify.toString() },
        create: {
          key: "auto_verify_users",
          value: autoVerify.toString(),
        },
      });

      res.json({
        success: true,
        message: "Auto-verify setting updated successfully",
        data: {
          autoVerify: setting.value === "true",
        },
      });
    } catch (error) {
      console.error("Update auto-verify setting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update setting",
      });
    }
  }
}
