import { Request, Response } from "express";
import prisma from "../config/database";
import slugify from "slugify";

export class EventController {
  // ✅ 1. Create new event (Admin / Super Admin only)
  static async createEvent(req: Request, res: Response) {
    try {
      const {
        title,
        description,
        coverImage,
        location,
        eventType,
        startDate,
        endDate,
        registrationDeadline,
        maxAttendees,
        categoryId,
      } = req.body;

      if (!title || !description || !eventType || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields.",
        });
      }

      // Generate unique slug
      const slugBase = slugify(title, { lower: true, strict: true });
      let slug = slugBase;
      let count = 1;

      while (await prisma.event.findUnique({ where: { slug } })) {
        slug = `${slugBase}-${count++}`;
      }

      // Determine event status
      const now = new Date();
      let status: any = "UPCOMING";
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (now >= start && now <= end) status = "ONGOING";
      else if (now > end) status = "COMPLETED";

      const event = await prisma.event.create({
        data: {
          title,
          slug,
          description,
          coverImage,
          location,
          eventType,
          startDate: start,
          endDate: end,
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline)
            : null,
          maxAttendees: maxAttendees ? Number(maxAttendees) : null,
          status,
          categoryId: categoryId || null,
          createdById: req.user.id,
        },
        include: {
          category: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: "Event created successfully.",
        data: event,
      });
    } catch (error) {
      console.error("Create event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create event.",
      });
    }
  }

  // ✅ 2. Get all events (Public)
  static async getAllEvents(req: Request, res: Response) {
    try {
      const {
        status,
        eventType,
        category,
        search,
        startDate,
        endDate,
        sort = "desc",
      } = req.query;

      const filters: any = {};

      if (status) filters.status = status;
      if (eventType) filters.eventType = eventType;
      if (category)
        filters.category = {
          name: { contains: String(category), mode: "insensitive" },
        };
      if (search)
        filters.OR = [
          { title: { contains: String(search), mode: "insensitive" } },
          { description: { contains: String(search), mode: "insensitive" } },
        ];

      if (startDate && endDate) {
        filters.startDate = { gte: new Date(startDate as string) };
        filters.endDate = { lte: new Date(endDate as string) };
      }

      const events = await prisma.event.findMany({
        where: filters,
        orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
        include: {
          category: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          _count: { select: { registrations: true } },
        },
      });

      return res.status(200).json({
        success: true,
        count: events.length,
        data: events,
      });
    } catch (error) {
      console.error("Get all events error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch events.",
      });
    }
  }

  // ✅ 3. Get single event (Public)
  static async getEventById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          category: true,
          createdBy: {
            select: { id: true, name: true, email: true, role: true },
          },
          registrations: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          gallery: true,
        },
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: event,
      });
    } catch (error) {
      console.error("Get event by id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch event.",
      });
    }
  }

  // ✅ 4. Update event (Admin / Super Admin)
  static async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = await prisma.event.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      // Recalculate status based on updated dates
      const now = new Date();
      const start = updates.startDate
        ? new Date(updates.startDate)
        : existing.startDate;
      const end = updates.endDate
        ? new Date(updates.endDate)
        : existing.endDate;

      let status = existing.status;
      if (now >= start && now <= end) status = "ONGOING";
      else if (now < start) status = "UPCOMING";
      else if (now > end) status = "COMPLETED";

      const updatedEvent = await prisma.event.update({
        where: { id },
        data: {
          ...updates,
          startDate: start,
          endDate: end,
          status,
        },
        include: {
          category: true,
          createdBy: { select: { id: true, name: true, role: true } },
        },
      });

      return res.status(200).json({
        success: true,
        message: "Event updated successfully.",
        data: updatedEvent,
      });
    } catch (error) {
      console.error("Update event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update event.",
      });
    }
  }

  // ✅ 5. Soft delete event (Admin / Super Admin)
  static async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const event = await prisma.event.findUnique({ where: { id } });
      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      // Soft delete → mark as CANCELLED instead of removing
      const cancelledEvent = await prisma.event.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return res.status(200).json({
        success: true,
        message: "Event cancelled (soft deleted) successfully.",
        data: cancelledEvent,
      });
    } catch (error) {
      console.error("Delete event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete event.",
      });
    }
  }

  // ✅ 6. RSVP to an event (Authenticated Users)
  static async registerForEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const event = await prisma.event.findUnique({
        where: { id },
        include: { registrations: true },
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      // Check registration deadline
      if (
        event.registrationDeadline &&
        new Date() > event.registrationDeadline
      ) {
        return res.status(400).json({
          success: false,
          message: "Registration deadline has passed.",
        });
      }

      // Check duplicates
      const existing = await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: id, userId } },
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "You are already registered for this event.",
        });
      }

      const registration = await prisma.eventRegistration.create({
        data: { eventId: id, userId },
      });

      return res.status(201).json({
        success: true,
        message: "Registered for event successfully.",
        data: registration,
      });
    } catch (error) {
      console.error("RSVP event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to register for event.",
      });
    }
  }
}
