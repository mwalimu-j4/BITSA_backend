import { Request, Response } from "express";
import prisma from "../config/database";
import { z, ZodError } from "zod";

// Validation schemas
const createContactSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  position: z.enum([
    "PRESIDENT",
    "VICE_PRESIDENT",
    "SECRETARY",
    "TREASURER",
    "ORGANIZING_SECRETARY",
    "ACADEMIC_SECRETARY",
    "ADMIN_STAFF",
    "PATRON",
    "OTHER",
  ]),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 characters"),
  photo: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateContactSchema = createContactSchema.partial();

export class ContactController {
  // Get all contact persons (public)
  static async getAllContacts(req: Request, res: Response) {
    try {
      const contacts = await prisma.contactPerson.findMany({
        where: { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });

      return res.status(200).json({
        success: true,
        data: contacts,
        count: contacts.length,
      });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch contacts",
      });
    }
  }

  // Get all contacts including inactive (admin only)
  static async getAllContactsAdmin(req: Request, res: Response) {
    try {
      const contacts = await prisma.contactPerson.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      });

      return res.status(200).json({
        success: true,
        data: contacts,
        count: contacts.length,
      });
    } catch (error) {
      console.error("Error fetching contacts (admin):", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch contacts",
      });
    }
  }

  // Get single contact by ID
  static async getContactById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const contact = await prisma.contactPerson.findUnique({
        where: { id },
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: contact,
      });
    } catch (error) {
      console.error("Error fetching contact:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch contact",
      });
    }
  }

  // Create new contact (admin only)
  static async createContact(req: Request, res: Response) {
    try {
      const validatedData = createContactSchema.parse(req.body);

      // Check if position already exists (for president/vice president)
      if (
        validatedData.position === "PRESIDENT" ||
        validatedData.position === "VICE_PRESIDENT"
      ) {
        const existing = await prisma.contactPerson.findFirst({
          where: {
            position: validatedData.position,
            isActive: true,
          },
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            message: `A ${validatedData.position
              .replace("_", " ")
              .toLowerCase()} already exists. Please deactivate the existing one first.`,
          });
        }
      }

      const contact = await prisma.contactPerson.create({
        data: validatedData,
      });

      return res.status(201).json({
        success: true,
        message: "Contact created successfully",
        data: contact,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Zod validation error:", error.format());
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.issues,
        });
      }

      console.error("Error creating contact:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create contact",
      });
    }
  }

  // Update contact (admin only)
  static async updateContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const validatedData = updateContactSchema.parse(req.body);

      // Check if contact exists
      const existingContact = await prisma.contactPerson.findUnique({
        where: { id },
      });

      if (!existingContact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      // If updating position to president/vice president, check for duplicates
      if (
        validatedData.position &&
        (validatedData.position === "PRESIDENT" ||
          validatedData.position === "VICE_PRESIDENT")
      ) {
        const existing = await prisma.contactPerson.findFirst({
          where: {
            position: validatedData.position,
            isActive: true,
            id: { not: id },
          },
        });

        if (existing) {
          return res.status(400).json({
            success: false,
            message: `A ${validatedData.position
              .replace("_", " ")
              .toLowerCase()} already exists.`,
          });
        }
      }

      const contact = await prisma.contactPerson.update({
        where: { id },
        data: validatedData,
      });

      return res.status(200).json({
        success: true,
        message: "Contact updated successfully",
        data: contact,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: error.issues,
        });
      }

      console.error("Error updating contact:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update contact",
      });
    }
  }

  // Delete contact (admin only)
  static async deleteContact(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const contact = await prisma.contactPerson.findUnique({
        where: { id },
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      await prisma.contactPerson.delete({
        where: { id },
      });

      return res.status(200).json({
        success: true,
        message: "Contact deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting contact:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete contact",
      });
    }
  }

  // Toggle contact active status (admin only)
  static async toggleContactStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const contact = await prisma.contactPerson.findUnique({
        where: { id },
      });

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: "Contact not found",
        });
      }

      const updated = await prisma.contactPerson.update({
        where: { id },
        data: { isActive: !contact.isActive },
      });

      return res.status(200).json({
        success: true,
        message: `Contact ${
          updated.isActive ? "activated" : "deactivated"
        } successfully`,
        data: updated,
      });
    } catch (error) {
      console.error("Error toggling contact status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to toggle contact status",
      });
    }
  }

  // Reorder contacts (admin only)
  static async reorderContacts(req: Request, res: Response) {
    try {
      const { contacts } = req.body as {
        contacts: { id: string; order: number }[];
      };

      if (!Array.isArray(contacts)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request body",
        });
      }

      // Update all contacts in a transaction
      await prisma.$transaction(
        contacts.map((contact) =>
          prisma.contactPerson.update({
            where: { id: contact.id },
            data: { order: contact.order },
          })
        )
      );

      return res.status(200).json({
        success: true,
        message: "Contacts reordered successfully",
      });
    } catch (error) {
      console.error("Error reordering contacts:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to reorder contacts",
      });
    }
  }
}
