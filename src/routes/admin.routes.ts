// src/routes/admin.routes.ts
import { Router } from "express";
import { AdminController } from "../controllers/admin.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// All routes require authentication and ADMIN or SUPER_ADMIN role
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"));

// User Management Routes
router.get("/users", AdminController.getAllUsers);
router.get("/users/stats", AdminController.getUserStats);
router.patch("/users/:id", AdminController.updateUser);
router.delete("/users/:id", AdminController.deleteUser);
router.patch("/users/:id/toggle-status", AdminController.toggleUserStatus);
router.patch("/users/:id/update-role", AdminController.updateUserRole);
router.patch("/users/verify-all", AdminController.verifyAllUsers);

// Settings Routes
router.get("/settings/auto-verify", AdminController.getAutoVerifySetting);
router.patch("/settings/auto-verify", AdminController.updateAutoVerifySetting);

export default router;
