import { Router } from "express";
import { EventController } from "../controllers/event.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", AuthMiddleware.optionalAuth, EventController.getAllEvents);
router.get(
  "/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.getEventStats
);
router.get(
  "/my-registrations",
  AuthMiddleware.authenticate,
  EventController.getMyRegistrations
);
router.get(
  "/id/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.getEventById
);
router.get(
  "/:slug",
  AuthMiddleware.optionalAuth,
  EventController.getEventBySlug
);
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
router.post(
  "/register",
  AuthMiddleware.authenticate,
  EventController.registerForEvent
);
router.delete(
  "/registrations/:id",
  AuthMiddleware.authenticate,
  EventController.cancelRegistration
);
router.patch(
  "/registrations/:id/attendance",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.updateAttendanceStatus
);


export default router;
