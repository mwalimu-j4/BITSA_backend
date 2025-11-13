import { Router } from "express";
import { ContactController } from "../controllers/contact.controller";
import { AuthMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.get("/", ContactController.getAllContacts);
router.get("/:id", ContactController.getContactById);

// Admin-only routes
router.get(
  "/admin/all",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.getAllContactsAdmin
);

router.post(
  "/",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.createContact
);

router.put(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.updateContact
);

router.delete(
  "/:id",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.deleteContact
);

router.patch(
  "/:id/toggle-status",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.toggleContactStatus
);

router.post(
  "/reorder",
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize("ADMIN", "SUPER_ADMIN"),
  ContactController.reorderContacts
);

export default router;
