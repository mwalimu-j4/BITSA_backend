// src/controllers/notification.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";
import { Role } from "@prisma/client";

export class NotificationController {
  // Get all notifications (admin only)
  static async getAllNotifications(req: Request, res: Response) {
    try {
      const { status, type, search, page = "1", limit = "10" } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status) where.status = status;
      if (type) where.type = type;
      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: "insensitive" } },
          { message: { contains: search as string, mode: "insensitive" } },
        ];
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
                studentId: true,
              },
            },
            _count: {
              select: {
                userNotifications: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.notification.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: notifications,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
      });
    }
  }

  // Get notification statistics
  static async getStats(req: Request, res: Response) {
    try {
      const [total, sent, scheduled, draft, cancelled] = await Promise.all([
        prisma.notification.count(),
        prisma.notification.count({ where: { status: "SENT" } }),
        prisma.notification.count({ where: { status: "SCHEDULED" } }),
        prisma.notification.count({ where: { status: "DRAFT" } }),
        prisma.notification.count({ where: { status: "CANCELLED" } }),
      ]);

      // Get monthly data for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyData = await prisma.notification.groupBy({
        by: ["createdAt"],
        where: {
          createdAt: { gte: sixMonthsAgo },
          status: "SENT",
        },
        _count: true,
      });

      // Format monthly data
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleString("default", { month: "short" });

        const count = monthlyData.filter((item) => {
          const itemDate = new Date(item.createdAt);
          return (
            itemDate.getMonth() === date.getMonth() &&
            itemDate.getFullYear() === date.getFullYear()
          );
        }).length;

        months.push({ month: monthName, count });
      }

      return res.status(200).json({
        success: true,
        data: {
          total,
          sent,
          scheduled,
          draft,
          cancelled,
          monthlyData: months,
        },
      });
    } catch (error) {
      console.error("Get stats error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch statistics",
      });
    }
  }

  // Create notification
  static async createNotification(req: Request, res: Response) {
    try {
      const {
        title,
        message,
        type,
        priority,
        targetAudience,
        targetRoles,
        targetUserIds,
        scheduledFor,
        link,
        linkText,
        sendNow,
      } = req.body;

      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          type,
          priority: priority || "MEDIUM",
          targetAudience: targetAudience || "ALL_USERS",
          targetRoles: targetRoles || [],
          targetUserIds: targetUserIds || [],
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          link,
          linkText,
          status: sendNow ? "SENT" : scheduledFor ? "SCHEDULED" : "DRAFT",
          sentAt: sendNow ? new Date() : null,
          createdById: req.user!.id,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              studentId: true,
            },
          },
        },
      });

      // If sending now, create user notifications
      if (sendNow) {
        await NotificationController.sendNotification(notification.id);
      }

      return res.status(201).json({
        success: true,
        message: sendNow
          ? "Notification sent successfully"
          : "Notification created successfully",
        data: notification,
      });
    } catch (error) {
      console.error("Create notification error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create notification",
      });
    }
  }

  // Update notification
  static async updateNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const {
        title,
        message,
        type,
        priority,
        targetAudience,
        targetRoles,
        targetUserIds,
        scheduledFor,
        link,
        linkText,
      } = req.body;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (notification.status === "SENT") {
        return res.status(400).json({
          success: false,
          message: "Cannot update sent notifications",
        });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: {
          title,
          message,
          type,
          priority,
          targetAudience,
          targetRoles,
          targetUserIds,
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
          link,
          linkText,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              studentId: true,
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Notification updated successfully",
        data: updated,
      });
    } catch (error) {
      console.error("Update notification error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update notification",
      });
    }
  }

  // Send notification
  static async sendNotification(notificationId: string) {
    try {
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) return;

      // Get target users
      let userIds: string[] = [];

      if (notification.targetAudience === "ALL_USERS") {
        const users = await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      } else if (notification.targetAudience === "SPECIFIC_ROLES") {
        const users = await prisma.user.findMany({
          where: {
            isActive: true,
            role: { in: notification.targetRoles as Role[] },
          },
          select: { id: true },
        });
        userIds = users.map((u) => u.id);
      } else if (notification.targetAudience === "SPECIFIC_USERS") {
        userIds = notification.targetUserIds;
      }

      // Create user notifications
      await prisma.userNotification.createMany({
        data: userIds.map((userId) => ({
          userId,
          notificationId: notification.id,
        })),
        skipDuplicates: true,
      });

      // Update notification status
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          totalRecipients: userIds.length,
        },
      });
    } catch (error) {
      console.error("Send notification error:", error);
    }
  }

  // Send notification now (trigger)
  static async sendNotificationNow(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (notification.status === "SENT") {
        return res.status(400).json({
          success: false,
          message: "Notification already sent",
        });
      }

      await NotificationController.sendNotification(id);

      return res.status(200).json({
        success: true,
        message: "Notification sent successfully",
      });
    } catch (error) {
      console.error("Send notification now error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to send notification",
      });
    }
  }

  // Cancel notification
  static async cancelNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      if (notification.status === "SENT") {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel sent notifications",
        });
      }

      await prisma.notification.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return res.status(200).json({
        success: true,
        message: "Notification cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel notification error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to cancel notification",
      });
    }
  }

  // Delete notification
  static async deleteNotification(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const notification = await prisma.notification.findUnique({
        where: { id },
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await prisma.notification.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      console.error("Delete notification error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete notification",
      });
    }
  }

  // Get user notifications (for students)
  static async getUserNotifications(req: Request, res: Response) {
    try {
      const { page = "1", limit = "20", unreadOnly } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        userId: req.user!.id,
      };

      if (unreadOnly === "true") {
        where.read = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.userNotification.findMany({
          where,
          include: {
            notification: {
              select: {
                id: true,
                title: true,
                message: true,
                type: true,
                priority: true,
                link: true,
                linkText: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        prisma.userNotification.count({ where }),
        prisma.userNotification.count({
          where: { userId: req.user!.id, read: false },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: notifications,
        unreadCount,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Get user notifications error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
      });
    }
  }

  // Mark notification as read
  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const userNotification = await prisma.userNotification.findFirst({
        where: {
          id,
          userId: req.user!.id,
        },
      });

      if (!userNotification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found",
        });
      }

      await prisma.userNotification.update({
        where: { id },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      // Update read count
      const readCount = await prisma.userNotification.count({
        where: {
          notificationId: userNotification.notificationId,
          read: true,
        },
      });

      await prisma.notification.update({
        where: { id: userNotification.notificationId },
        data: { readCount },
      });

      return res.status(200).json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      console.error("Mark as read error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
      });
    }
  }

  // Mark all as read
  static async markAllAsRead(req: Request, res: Response) {
    try {
      await prisma.userNotification.updateMany({
        where: {
          userId: req.user!.id,
          read: false,
        },
        data: {
          read: true,
          readAt: new Date(),
        },
      });

      return res.status(200).json({
        success: true,
        message: "All notifications marked as read",
      });
    } catch (error) {
      console.error("Mark all as read error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to mark all notifications as read",
      });
    }
  }
}
