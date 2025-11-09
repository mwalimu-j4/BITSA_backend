import { Request, Response } from "express";
import prisma from "../config/database";

export class EventController {
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
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (
        !title ||
        !description ||
        !location ||
        !eventType ||
        !startDate ||
        !endDate
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Title, description, location, event type, start date, and end date are required",
          });
      }

      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Date.now();

      const event = await prisma.event.create({
        data: {
          title,
          slug,
          description,
          coverImage: coverImage || null,
          location,
          eventType,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          registrationDeadline: registrationDeadline
            ? new Date(registrationDeadline)
            : null,
          maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
          createdById: userId,
          categoryId: categoryId || null,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, studentId: true, image: true },
          },
          category: true,
          _count: { select: { registrations: true } },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "CREATE_EVENT",
          entity: "Event",
          entityId: event.id,
          description: `Created event: ${title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(201)
        .json({
          success: true,
          message: "Event created successfully",
          data: { event },
        });
    } catch (error) {
      console.error("Create event error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while creating the event",
        });
    }
  }

  static async getAllEvents(req: Request, res: Response) {
    try {
      const {
        search,
        categoryId,
        eventType,
        status,
        page = 1,
        limit = 10,
        sortBy = "startDate",
        sortOrder = "desc",
      } = req.query as any;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: any = {};

      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
        ];
      }

      if (categoryId) where.categoryId = categoryId;
      if (eventType) where.eventType = eventType;
      if (status) where.status = status;

      const total = await prisma.event.count({ where });

      const events = await prisma.event.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          createdBy: {
            select: { id: true, name: true, studentId: true, image: true },
          },
          category: true,
          _count: { select: { registrations: true, gallery: true } },
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          events,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get all events error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while fetching events",
        });
    }
  }

  static async getEventById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const event = await prisma.event.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
              role: true,
            },
          },
          category: true,
          registrations: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  studentId: true,
                  email: true,
                  phone: true,
                  image: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          gallery: { orderBy: { uploadedAt: "desc" } },
          _count: { select: { registrations: true, gallery: true } },
        },
      });

      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      return res.status(200).json({ success: true, data: { event } });
    } catch (error) {
      console.error("Get event by ID error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while fetching the event",
        });
    }
  }

  static async getEventBySlug(req: Request, res: Response) {
    try {
      const { slug } = req.params;

      const event = await prisma.event.findUnique({
        where: { slug },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
              role: true,
            },
          },
          category: true,
          registrations: {
            include: {
              user: {
                select: { id: true, name: true, studentId: true, image: true },
              },
            },
          },
          gallery: { orderBy: { uploadedAt: "desc" } },
          _count: { select: { registrations: true, gallery: true } },
        },
      });

      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      return res.status(200).json({ success: true, data: { event } });
    } catch (error) {
      console.error("Get event by slug error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while fetching the event",
        });
    }
  }

  static async updateEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const existingEvent = await prisma.event.findUnique({ where: { id } });

      if (!existingEvent) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

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
        status,
      } = req.body;

      let newSlug = existingEvent.slug;
      if (title && title !== existingEvent.title) {
        newSlug =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") +
          "-" +
          Date.now();
      }

      const updateData: any = {};
      if (title) updateData.title = title;
      if (title) updateData.slug = newSlug;
      if (description) updateData.description = description;
      if (coverImage !== undefined) updateData.coverImage = coverImage || null;
      if (location) updateData.location = location;
      if (eventType) updateData.eventType = eventType;
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);
      if (registrationDeadline !== undefined)
        updateData.registrationDeadline = registrationDeadline
          ? new Date(registrationDeadline)
          : null;
      if (maxAttendees !== undefined)
        updateData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
      if (categoryId !== undefined) updateData.categoryId = categoryId || null;
      if (status) updateData.status = status;

      const event = await prisma.event.update({
        where: { id },
        data: updateData,
        include: {
          createdBy: {
            select: { id: true, name: true, studentId: true, image: true },
          },
          category: true,
          _count: { select: { registrations: true } },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "UPDATE_EVENT",
          entity: "Event",
          entityId: event.id,
          description: `Updated event: ${event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(200)
        .json({
          success: true,
          message: "Event updated successfully",
          data: { event },
        });
    } catch (error) {
      console.error("Update event error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while updating the event",
        });
    }
  }

  static async deleteEvent(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const event = await prisma.event.findUnique({ where: { id } });

      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      await prisma.event.delete({ where: { id } });

      await prisma.activity.create({
        data: {
          userId,
          action: "DELETE_EVENT",
          entity: "Event",
          entityId: id,
          description: `Deleted event: ${event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(200)
        .json({ success: true, message: "Event deleted successfully" });
    } catch (error) {
      console.error("Delete event error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while deleting the event",
        });
    }
  }

  static async registerForEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!eventId) {
        return res
          .status(400)
          .json({ success: false, message: "Event ID is required" });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { registrations: true } } },
      });

      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      if (
        event.registrationDeadline &&
        new Date() > new Date(event.registrationDeadline)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Registration deadline has passed",
          });
      }

      if (
        event.maxAttendees &&
        event._count.registrations >= event.maxAttendees
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Event is full" });
      }

      const existingRegistration = await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (existingRegistration) {
        return res
          .status(409)
          .json({
            success: false,
            message: "You are already registered for this event",
          });
      }

      const registration = await prisma.eventRegistration.create({
        data: { eventId, userId },
        include: {
          event: {
            select: { id: true, title: true, startDate: true, location: true },
          },
          user: {
            select: { id: true, name: true, studentId: true, email: true },
          },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "REGISTER_EVENT",
          entity: "EventRegistration",
          entityId: registration.id,
          description: `Registered for event: ${event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(201)
        .json({
          success: true,
          message: "Successfully registered for event",
          data: { registration },
        });
    } catch (error) {
      console.error("Register for event error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while registering for the event",
        });
    }
  }

  static async cancelRegistration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const registration = await prisma.eventRegistration.findUnique({
        where: { id },
        include: { event: true },
      });

      if (!registration) {
        return res
          .status(404)
          .json({ success: false, message: "Registration not found" });
      }

      if (
        userRole !== "ADMIN" &&
        userRole !== "SUPER_ADMIN" &&
        registration.userId !== userId
      ) {
        return res
          .status(403)
          .json({
            success: false,
            message: "You do not have permission to cancel this registration",
          });
      }

      await prisma.eventRegistration.delete({ where: { id } });

      await prisma.activity.create({
        data: {
          userId,
          action: "CANCEL_REGISTRATION",
          entity: "EventRegistration",
          entityId: id,
          description: `Cancelled registration for event: ${registration.event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(200)
        .json({
          success: true,
          message: "Registration cancelled successfully",
        });
    } catch (error) {
      console.error("Cancel registration error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while cancelling the registration",
        });
    }
  }

  static async updateAttendanceStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!["REGISTERED", "ATTENDED", "CANCELLED"].includes(status)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }

      const registration = await prisma.eventRegistration.findUnique({
        where: { id },
      });

      if (!registration) {
        return res
          .status(404)
          .json({ success: false, message: "Registration not found" });
      }

      const updatedRegistration = await prisma.eventRegistration.update({
        where: { id },
        data: { status },
        include: {
          user: {
            select: { id: true, name: true, studentId: true, email: true },
          },
          event: { select: { id: true, title: true } },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "UPDATE_ATTENDANCE",
          entity: "EventRegistration",
          entityId: id,
          description: `Updated attendance status to ${status}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res
        .status(200)
        .json({
          success: true,
          message: "Attendance status updated",
          data: { registration: updatedRegistration },
        });
    } catch (error) {
      console.error("Update attendance error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while updating attendance status",
        });
    }
  }

  static async getEventStats(req: Request, res: Response) {
    try {
      const totalEvents = await prisma.event.count();
      const upcomingEvents = await prisma.event.count({
        where: { status: "UPCOMING" },
      });
      const ongoingEvents = await prisma.event.count({
        where: { status: "ONGOING" },
      });
      const completedEvents = await prisma.event.count({
        where: { status: "COMPLETED" },
      });
      const totalRegistrations = await prisma.eventRegistration.count();

      const eventsWithCounts = await prisma.event.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          startDate: true,
          _count: { select: { registrations: true } },
        },
        orderBy: { registrations: { _count: "desc" } },
        take: 5,
      });

      const recentEvents = await prisma.event.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startDate: true,
          createdAt: true,
          createdBy: { select: { name: true, studentId: true } },
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          stats: {
            totalEvents,
            upcomingEvents,
            ongoingEvents,
            completedEvents,
            totalRegistrations,
          },
          mostPopularEvents: eventsWithCounts,
          recentEvents,
        },
      });
    } catch (error) {
      console.error("Get event stats error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while fetching event statistics",
        });
    }
  }

  static async getMyRegistrations(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const registrations = await prisma.eventRegistration.findMany({
        where: { userId },
        include: {
          event: {
            include: {
              category: true,
              createdBy: { select: { name: true, studentId: true } },
              _count: { select: { registrations: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return res.status(200).json({ success: true, data: { registrations } });
    } catch (error) {
      console.error("Get my registrations error:", error);
      return res
        .status(500)
        .json({
          success: false,
          message: "An error occurred while fetching your registrations",
        });
    }
  }
}
