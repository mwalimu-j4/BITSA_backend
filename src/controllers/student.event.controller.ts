// src/controllers/student.event.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";

export class StudentEventController {
  // Get all published events for students
  static async getAllEvents(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const {
        search,
        categoryId,
        eventType,
        status,
        page = 1,
        limit = 12,
        sortBy = "startDate",
        sortOrder = "asc",
      } = req.query as any;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: any = {};

      // Filter search
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
          category: true,
          _count: { select: { registrations: true } },
          registrations: userId
            ? {
                where: { userId },
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                },
              }
            : false,
        },
      });

      // Add registration info to each event
      const eventsWithRegistration = events.map((event) => ({
        ...event,
        isRegistered: userId
          ? (event.registrations as any[]).length > 0
          : false,
        myRegistration: userId
          ? (event.registrations as any[])[0] || null
          : null,
        availableSlots: event.maxAttendees
          ? event.maxAttendees - event._count.registrations
          : null,
        isFull:
          event.maxAttendees && event._count.registrations >= event.maxAttendees
            ? true
            : false,
      }));

      return res.status(200).json({
        success: true,
        data: {
          events: eventsWithRegistration,
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
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching events",
      });
    }
  }

  // Get single event details for students
  static async getEventDetails(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;

      const event = await prisma.event.findUnique({
        where: { id: eventId, published: true }, // Only show published events
        include: {
          category: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
          _count: { select: { registrations: true, gallery: true } },
          registrations: userId
            ? {
                where: { userId },
                select: {
                  id: true,
                  status: true,
                  createdAt: true,
                },
              }
            : false,
        },
      });

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found or not published",
        });
      }

      // Add registration info
      const eventWithInfo = {
        ...event,
        isRegistered: userId
          ? (event.registrations as any[]).length > 0
          : false,
        myRegistration: userId
          ? (event.registrations as any[])[0] || null
          : null,
        availableSlots: event.maxAttendees
          ? event.maxAttendees - event._count.registrations
          : null,
        isFull:
          event.maxAttendees && event._count.registrations >= event.maxAttendees
            ? true
            : false,
      };

      return res.status(200).json({
        success: true,
        data: { event: eventWithInfo },
      });
    } catch (error) {
      console.error("Get event details error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching event details",
      });
    }
  }

  // Get student's own registrations
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
              _count: { select: { registrations: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Separate by status
      const upcoming = registrations.filter(
        (reg) => reg.event.status === "UPCOMING" && reg.status === "REGISTERED"
      );
      const attended = registrations.filter((reg) => reg.status === "ATTENDED");
      const cancelled = registrations.filter(
        (reg) => reg.status === "CANCELLED"
      );

      return res.status(200).json({
        success: true,
        data: {
          all: registrations,
          upcoming,
          attended,
          cancelled,
          stats: {
            total: registrations.length,
            upcoming: upcoming.length,
            attended: attended.length,
            cancelled: cancelled.length,
          },
        },
      });
    } catch (error) {
      console.error("Get my registrations error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching your registrations",
      });
    }
  }

  // Register for event
  static async registerForEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.body;
      const userId = req.user?.id;

      console.log("📝 Registration attempt:", { eventId, userId });

      if (!userId) {
        console.log("❌ No user ID found");
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!eventId) {
        console.log("❌ No event ID provided");
        return res
          .status(400)
          .json({ success: false, message: "Event ID is required" });
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { _count: { select: { registrations: true } } },
      });

      if (!event) {
        console.log("❌ Event not found:", eventId);
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      console.log("📅 Event details:", {
        title: event.title,
        status: event.status,
        registrationDeadline: event.registrationDeadline,
        currentRegistrations: event._count.registrations,
        maxAttendees: event.maxAttendees,
      });

      // Check if already registered FIRST (before other validations)
      const existingRegistration = await prisma.eventRegistration.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (existingRegistration) {
        console.log("⚠️ User already registered:", existingRegistration.id);
        return res.status(409).json({
          success: false,
          message: "You are already registered for this event",
        });
      }

      // Check if event is cancelled
      if (event.status === "CANCELLED") {
        console.log("❌ Event is cancelled");
        return res.status(400).json({
          success: false,
          message: "This event has been cancelled",
        });
      }

      // Check if event has already started or completed
      if (event.status === "COMPLETED") {
        console.log("❌ Event is completed");
        return res.status(400).json({
          success: false,
          message: "Registration closed - event has ended",
        });
      }

      // Check if registration deadline passed (only if deadline is set)
      if (event.registrationDeadline) {
        const now = new Date();
        const deadline = new Date(event.registrationDeadline);

        console.log("🕐 Deadline check:", {
          now: now.toISOString(),
          deadline: deadline.toISOString(),
          isPassed: now > deadline,
        });

        if (now > deadline) {
          console.log("❌ Registration deadline passed");
          return res.status(400).json({
            success: false,
            message: "Registration deadline has passed",
          });
        }
      }

      // Check if event is full (only if max attendees is set)
      if (event.maxAttendees && event.maxAttendees > 0) {
        console.log("👥 Capacity check:", {
          current: event._count.registrations,
          max: event.maxAttendees,
          isFull: event._count.registrations >= event.maxAttendees,
        });

        if (event._count.registrations >= event.maxAttendees) {
          console.log("❌ Event is full");
          return res.status(400).json({
            success: false,
            message: "Event is full - maximum capacity reached",
          });
        }
      }

      // All validations passed, create registration
      console.log("✅ All validations passed, creating registration...");

      const registration = await prisma.eventRegistration.create({
        data: { eventId, userId },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              location: true,
            },
          },
        },
      });

      console.log("✅ Registration created:", registration.id);

      // Log activity
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

      return res.status(201).json({
        success: true,
        message: "Successfully registered for event",
        data: { registration },
      });
    } catch (error: any) {
      console.error("❌ Register for event error:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        code: error.code,
      });

      // Handle Prisma unique constraint errors
      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "You are already registered for this event",
        });
      }

      return res.status(500).json({
        success: false,
        message: "An error occurred while registering for the event",
      });
    }
  }

  // Cancel registration
  static async cancelRegistration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

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

      if (registration.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own registrations",
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

      return res.status(200).json({
        success: true,
        message: "Registration cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel registration error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while cancelling the registration",
      });
    }
  }

  // Get student dashboard stats
  static async getDashboardStats(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Total registrations
      const totalRegistrations = await prisma.eventRegistration.count({
        where: { userId },
      });

      // Attended events
      const attendedEvents = await prisma.eventRegistration.count({
        where: { userId, status: "ATTENDED" },
      });

      // Upcoming events
      const upcomingEvents = await prisma.eventRegistration.count({
        where: {
          userId,
          status: "REGISTERED",
          event: { status: "UPCOMING" },
        },
      });

      // Events by type (for pie chart)
      const eventsByType = await prisma.eventRegistration.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      });

      // Monthly attendance (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyAttendance = await prisma.eventRegistration.findMany({
        where: {
          userId,
          createdAt: { gte: sixMonthsAgo },
        },
        select: {
          createdAt: true,
          event: { select: { eventType: true } },
        },
      });

      // Group by month
      const monthlyData: { [key: string]: number } = {};
      monthlyAttendance.forEach((reg) => {
        const month = new Date(reg.createdAt).toLocaleDateString("en-US", {
          month: "short",
        });
        monthlyData[month] = (monthlyData[month] || 0) + 1;
      });

      // Event type breakdown
      const typeBreakdown = await prisma.eventRegistration.groupBy({
        by: ["status"],
        where: { userId },
        _count: true,
      });

      const eventTypeData = await prisma.$queryRaw`
        SELECT e."eventType", COUNT(*)::int as count
        FROM "event_registrations" er
        JOIN "events" e ON er."eventId" = e.id
        WHERE er."userId" = ${userId}
        GROUP BY e."eventType"
      `;

      return res.status(200).json({
        success: true,
        data: {
          stats: {
            totalRegistrations,
            attendedEvents,
            upcomingEvents,
            membershipStatus: "Active",
          },
          monthlyAttendance: monthlyData,
          eventsByType: eventTypeData,
          typeBreakdown,
        },
      });
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching dashboard stats",
      });
    }
  }
}
