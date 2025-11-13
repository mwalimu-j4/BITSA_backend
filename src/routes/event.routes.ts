// src/routes/event.routes.ts - Updated version
import { Router } from "express";
import { EventController } from "../controllers/event.controller";
import { StudentEventController } from "../controllers/student.event.controller";
import { EventFormController } from "../controllers/event-form.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// ============================================
// STUDENT ROUTES (Public/Student Access)
// ============================================

// Student dashboard stats
router.get(
  "/student/dashboard-stats",
  AuthMiddleware.authenticate,
  StudentEventController.getDashboardStats
);

// Student's own registrations
router.get(
  "/student/my-registrations",
  AuthMiddleware.authenticate,
  StudentEventController.getMyRegistrations
);

// Get all events (student view with registration status)
router.get(
  "/student/all",
  AuthMiddleware.authenticate,
  StudentEventController.getAllEvents
);

// Simple registration (no form)
router.post(
  "/student/simple-register",
  AuthMiddleware.authenticate,
  EventController.simpleRegister
);

// Get registration form for event
router.get(
  "/student/form/:eventId",
  AuthMiddleware.authenticate,
  EventFormController.getFormByEventId
);

// Submit registration form
router.post(
  "/student/form/submit",
  AuthMiddleware.authenticate,
  EventFormController.submitForm
);

// Get my submission status for an event
router.get(
  "/student/submission/:eventId",
  AuthMiddleware.authenticate,
  EventFormController.getMySubmission
);

// Register for event (student) - deprecated, use simple-register or form submit
router.post(
  "/student/register",
  AuthMiddleware.authenticate,
  StudentEventController.registerForEvent
);

// Cancel registration (student)
router.delete(
  "/student/register/:id",
  AuthMiddleware.authenticate,
  StudentEventController.cancelRegistration
);

// ============================================
// ADMIN ROUTES - REGISTRATION FORMS
// ============================================

// Create/update registration form for event
router.post(
  "/admin/form/:eventId",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.createOrUpdateForm
);

// Get registration form by event ID
router.get(
  "/admin/form/:eventId",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.getFormByEventId
);

// Get all submissions for an event
router.get(
  "/admin/submissions/:eventId",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.getEventSubmissions
);

// Update submission status (approve/reject)
router.patch(
  "/admin/submissions/:id/status",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.updateSubmissionStatus
);

// Bulk approve submissions
router.post(
  "/admin/submissions/bulk-approve",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.bulkApproveSubmissions
);

// Mark attendance
router.patch(
  "/admin/submissions/:id/attendance",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.markAttendance
);

// Get attendance statistics
router.get(
  "/admin/attendance/:eventId",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventFormController.getAttendanceStats
);

// ============================================
// ADMIN ROUTES - EVENT MANAGEMENT
// ============================================

// Get event statistics (admin only)
router.get(
  "/stats",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.getEventStats
);

// Toggle publish status
router.patch(
  "/:id/publish",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.togglePublish
);

// Get all events (admin view)
router.get("/", AuthMiddleware.optionalAuth, EventController.getAllEvents);

// Get user's registrations (admin can see any user's registrations)
router.get(
  "/my-registrations",
  AuthMiddleware.authenticate,
  EventController.getMyRegistrations
);

// Get event by ID (admin)
router.get(
  "/id/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.getEventById
);

// Get event by slug (public)
router.get(
  "/:slug",
  AuthMiddleware.optionalAuth,
  EventController.getEventBySlug
);

// Create event (admin only)
router.post(
  "/",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.createEvent
);

// Update event (admin only)
router.put(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.updateEvent
);

// Delete event (admin only)
router.delete(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.deleteEvent
);

// Register for event (admin can register anyone)
router.post(
  "/register",
  AuthMiddleware.authenticate,
  EventController.registerForEvent
);

// Cancel registration (admin can cancel any registration)
router.delete(
  "/registrations/:id",
  AuthMiddleware.authenticate,
  EventController.cancelRegistration
);

// Update attendance status (admin only)
router.patch(
  "/registrations/:id/attendance",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  EventController.updateAttendanceStatus
);

export default router;
