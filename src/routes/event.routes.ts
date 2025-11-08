import { Router } from "express";
import { EventController } from "../controllers/event.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

/**
 * ==========================================================
 * 🧭 EVENT MANAGEMENT ROUTES
 * ==========================================================
 * Only Admin and Super Admin can perform CRUD actions.
 * All users (authenticated or not) can view events.
 * ==========================================================
 */

// ✅ Public routes
router.get("/", EventController.getAllEvents); // Fetch all events (filters supported)
router.get("/:id", EventController.getEventById); // Get specific event details

// ✅ Authenticated users — RSVP registration
router.post(
  "/:id/register",
  AuthMiddleware.authenticate,
  EventController.registerForEvent
);

// ✅ Admin / Super Admin routes — Create, Update, Soft Delete
router.post(
  "/",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.createEvent
);

router.put(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.updateEvent
);

router.delete(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.deleteEvent
);

export default router;
