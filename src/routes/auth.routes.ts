import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post("/signup", AuthController.signup);
router.post("/login", AuthController.login);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);

// Protected routes
router.post("/logout", AuthMiddleware.authenticate, AuthController.logout);
router.get("/me", AuthMiddleware.authenticate, AuthController.getCurrentUser);

export default router;
