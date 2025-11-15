// src/routes/notification.routes.ts
import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Admin routes
router.get(
  "/admin",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.getAllNotifications
);

router.get(
  "/admin/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.getStats
);

router.post(
  "/admin",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.createNotification
);

router.put(
  "/admin/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.updateNotification
);

router.post(
  "/admin/:id/send",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.sendNotificationNow
);

router.post(
  "/admin/:id/cancel",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.cancelNotification
);

router.delete(
  "/admin/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  NotificationController.deleteNotification
);

// User routes
router.get(
  "/",
  AuthMiddleware.authenticate,
  NotificationController.getUserNotifications
);

router.post(
  "/:id/read",
  AuthMiddleware.authenticate,
  NotificationController.markAsRead
);

router.post(
  "/read-all",
  AuthMiddleware.authenticate,
  NotificationController.markAllAsRead
);

export default router;
