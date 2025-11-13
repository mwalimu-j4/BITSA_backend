// src/controllers/event-form.controller.ts
import { Request, Response } from "express";
import prisma from "../config/database";

export class EventFormController {
  // Create or update registration form for an event
  static async createOrUpdateForm(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const { requiresApproval, fields } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Check if event exists and user has permission
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event) {
        return res
          .status(404)
          .json({ success: false, message: "Event not found" });
      }

      // Validate fields
      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one field is required",
        });
      }

      // Check if form already exists
      const existingForm = await prisma.eventRegistrationForm.findUnique({
        where: { eventId },
        include: { fields: true },
      });

      let form;

      if (existingForm) {
        // Delete existing fields
        await prisma.eventRegistrationField.deleteMany({
          where: { formId: existingForm.id },
        });

        // Update form and create new fields
        form = await prisma.eventRegistrationForm.update({
          where: { id: existingForm.id },
          data: {
            requiresApproval,
            fields: {
              create: fields.map((field: any, index: number) => ({
                label: field.label,
                fieldType: field.fieldType,
                placeholder: field.placeholder || null,
                required: field.required || false,
                options: field.options || [],
                order: index,
                validation: field.validation
                  ? JSON.stringify(field.validation)
                  : null,
              })),
            },
          },
          include: { fields: { orderBy: { order: "asc" } } },
        });
      } else {
        // Create new form
        form = await prisma.eventRegistrationForm.create({
          data: {
            eventId,
            requiresApproval,
            fields: {
              create: fields.map((field: any, index: number) => ({
                label: field.label,
                fieldType: field.fieldType,
                placeholder: field.placeholder || null,
                required: field.required || false,
                options: field.options || [],
                order: index,
                validation: field.validation
                  ? JSON.stringify(field.validation)
                  : null,
              })),
            },
          },
          include: { fields: { orderBy: { order: "asc" } } },
        });
      }

      // Update event to require registration
      await prisma.event.update({
        where: { id: eventId },
        data: { requiresRegistration: true },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "CREATE_REGISTRATION_FORM",
          entity: "EventRegistrationForm",
          entityId: form.id,
          description: `Created registration form for event: ${event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Registration form created successfully",
        data: { form },
      });
    } catch (error) {
      console.error("Create registration form error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while creating registration form",
      });
    }
  }

  // Get registration form for an event
  static async getFormByEventId(req: Request, res: Response) {
    try {
      const { eventId } = req.params;

      const form = await prisma.eventRegistrationForm.findUnique({
        where: { eventId },
        include: {
          fields: { orderBy: { order: "asc" } },
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Registration form not found",
        });
      }

      return res.status(200).json({ success: true, data: { form } });
    } catch (error) {
      console.error("Get registration form error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching registration form",
      });
    }
  }

  // Submit registration form (student)
  static async submitForm(req: Request, res: Response) {
    try {
      const { formId, responses } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      // Get form with event details
      const form = await prisma.eventRegistrationForm.findUnique({
        where: { id: formId },
        include: {
          fields: true,
          event: true,
        },
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "Registration form not found",
        });
      }

      // Check if event is still accepting registrations
      if (
        form.event.registrationDeadline &&
        new Date() > form.event.registrationDeadline
      ) {
        return res.status(400).json({
          success: false,
          message: "Registration deadline has passed",
        });
      }

      // Check if already submitted
      const existing = await prisma.eventRegistrationSubmission.findUnique({
        where: {
          formId_userId: { formId, userId },
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You have already submitted a registration for this event",
        });
      }

      // Validate required fields
      for (const field of form.fields) {
        if (field.required && !responses[field.id]) {
          return res.status(400).json({
            success: false,
            message: `${field.label} is required`,
          });
        }
      }

      // Create submission
      const submission = await prisma.eventRegistrationSubmission.create({
        data: {
          formId,
          userId,
          eventId: form.eventId,
          responses,
          status: form.requiresApproval ? "PENDING" : "APPROVED",
          approvedAt: form.requiresApproval ? null : new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              studentId: true,
              email: true,
              image: true,
            },
          },
          form: {
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
          },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "SUBMIT_REGISTRATION",
          entity: "EventRegistrationSubmission",
          entityId: submission.id,
          description: `Submitted registration for: ${form.event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: form.requiresApproval
          ? "Registration submitted successfully. Awaiting approval."
          : "Registration successful!",
        data: { submission },
      });
    } catch (error) {
      console.error("Submit registration form error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while submitting registration",
      });
    }
  }

  // Get all submissions for an event (admin)
  static async getEventSubmissions(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const { status, search, page = 1, limit = 50 } = req.query as any;

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const where: any = { eventId };

      if (status) where.status = status;

      if (search) {
        where.user = {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { studentId: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        };
      }

      const [submissions, total] = await Promise.all([
        prisma.eventRegistrationSubmission.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                studentId: true,
                email: true,
                phone: true,
                image: true,
                course: true,
                yearOfStudy: true,
              },
            },
            form: {
              include: {
                fields: { orderBy: { order: "asc" } },
              },
            },
          },
        }),
        prisma.eventRegistrationSubmission.count({ where }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          submissions,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get event submissions error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching submissions",
      });
    }
  }

  // Approve/Reject submission (admin)
  static async updateSubmissionStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status, rejectionReason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!["APPROVED", "REJECTED", "WAITLISTED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      const submission = await prisma.eventRegistrationSubmission.findUnique({
        where: { id },
        include: {
          user: { select: { name: true, email: true } },
          form: { include: { event: true } },
        },
      });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Submission not found",
        });
      }

      const updated = await prisma.eventRegistrationSubmission.update({
        where: { id },
        data: {
          status,
          approvedBy: status === "APPROVED" ? userId : null,
          approvedAt: status === "APPROVED" ? new Date() : null,
          rejectionReason: status === "REJECTED" ? rejectionReason : null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              studentId: true,
              email: true,
            },
          },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: `${status}_REGISTRATION`,
          entity: "EventRegistrationSubmission",
          entityId: id,
          description: `${status} registration for: ${submission.form.event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Registration ${status.toLowerCase()} successfully`,
        data: { submission: updated },
      });
    } catch (error) {
      console.error("Update submission status error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while updating submission",
      });
    }
  }

  // Bulk approve submissions (admin)
  static async bulkApproveSubmissions(req: Request, res: Response) {
    try {
      const { submissionIds } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Submission IDs array is required",
        });
      }

      await prisma.eventRegistrationSubmission.updateMany({
        where: {
          id: { in: submissionIds },
          status: "PENDING",
        },
        data: {
          status: "APPROVED",
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "BULK_APPROVE_REGISTRATIONS",
          entity: "EventRegistrationSubmission",
          entityId: submissionIds[0],
          description: `Bulk approved ${submissionIds.length} registrations`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: `${submissionIds.length} registrations approved successfully`,
      });
    } catch (error) {
      console.error("Bulk approve error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while approving submissions",
      });
    }
  }

  // Mark attendance (admin)
  static async markAttendance(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { attended } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const submission = await prisma.eventRegistrationSubmission.findUnique({
        where: { id },
        include: {
          user: { select: { name: true } },
          form: { include: { event: { select: { title: true } } } },
        },
      });

      if (!submission) {
        return res.status(404).json({
          success: false,
          message: "Registration not found",
        });
      }

      if (submission.status !== "APPROVED") {
        return res.status(400).json({
          success: false,
          message: "Only approved registrations can have attendance marked",
        });
      }

      const updated = await prisma.eventRegistrationSubmission.update({
        where: { id },
        data: {
          attended,
          attendanceMarkedAt: new Date(),
          attendanceMarkedBy: userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              studentId: true,
              image: true,
            },
          },
        },
      });

      await prisma.activity.create({
        data: {
          userId,
          action: "MARK_ATTENDANCE",
          entity: "EventRegistrationSubmission",
          entityId: id,
          description: `Marked ${attended ? "present" : "absent"} for ${
            submission.user.name
          } at ${submission.form.event.title}`,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Attendance marked successfully",
        data: { submission: updated },
      });
    } catch (error) {
      console.error("Mark attendance error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while marking attendance",
      });
    }
  }

  // Get attendance statistics
  static async getAttendanceStats(req: Request, res: Response) {
    try {
      const { eventId } = req.params;

      const stats = await prisma.eventRegistrationSubmission.groupBy({
        by: ["attended", "status"],
        where: { eventId },
        _count: true,
      });

      const totalSubmissions = await prisma.eventRegistrationSubmission.count({
        where: { eventId },
      });

      const approved = await prisma.eventRegistrationSubmission.count({
        where: { eventId, status: "APPROVED" },
      });

      const attended = await prisma.eventRegistrationSubmission.count({
        where: { eventId, status: "APPROVED", attended: true },
      });

      const absent = await prisma.eventRegistrationSubmission.count({
        where: { eventId, status: "APPROVED", attended: false },
      });

      return res.status(200).json({
        success: true,
        data: {
          totalSubmissions,
          approved,
          attended,
          absent,
          attendanceRate:
            approved > 0 ? ((attended / approved) * 100).toFixed(2) : 0,
          details: stats,
        },
      });
    } catch (error) {
      console.error("Get attendance stats error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching attendance statistics",
      });
    }
  }

  // Get user's submission status for an event
  static async getMySubmission(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const form = await prisma.eventRegistrationForm.findUnique({
        where: { eventId },
      });

      if (!form) {
        return res.status(404).json({
          success: false,
          message: "No registration form found for this event",
        });
      }

      const submission = await prisma.eventRegistrationSubmission.findUnique({
        where: {
          formId_userId: { formId: form.id, userId },
        },
        include: {
          form: {
            include: {
              fields: { orderBy: { order: "asc" } },
              event: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  location: true,
                },
              },
            },
          },
        },
      });

      return res.status(200).json({
        success: true,
        data: { submission },
      });
    } catch (error) {
      console.error("Get my submission error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred while fetching your submission",
      });
    }
  }
}
