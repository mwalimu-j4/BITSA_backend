import { Request, Response, NextFunction } from "express";
import prisma from "../config/database";
import { TokenUtil } from "../utils/token.util";

export class AuthMiddleware {
  static async authenticate(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          message: "No token provided. Please login.",
        });
      }

      const token = authHeader.replace("Bearer ", "");

      // Verify token
      let decoded;
      try {
        decoded = TokenUtil.verify(token);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token. Please login again.",
        });
      }

      // Check if session exists and is valid
      const session = await prisma.session.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              studentId: true,
              email: true,
              phone: true,
              name: true,
              role: true,
              course: true,
              yearOfStudy: true,
              image: true,
              isActive: true,
            },
          },
        },
      });

      if (!session) {
        return res.status(401).json({
          success: false,
          message: "Session not found. Please login again.",
        });
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        await prisma.session.delete({ where: { id: session.id } });
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }

      // Check if user is active
      if (!session.user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact admin.",
        });
      }

      // Attach user to request
      req.user = session.user;

      next();
    } catch (error) {
      console.error("Authentication error:", error);
      return res.status(500).json({
        success: false,
        message: "Authentication failed",
      });
    }
  }

  static authorize(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login.",
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You do not have permission to perform this action.",
        });
      }

      next();
    };
  }

  static async optionalAuth(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
      }

      const token = authHeader.replace("Bearer ", "");

      try {
        const decoded = TokenUtil.verify(token);

        const session = await prisma.session.findUnique({
          where: { token },
          include: {
            user: {
              select: {
                id: true,
                studentId: true,
                email: true,
                phone: true,
                name: true,
                role: true,
                course: true,
                yearOfStudy: true,
                image: true,
                isActive: true,
              },
            },
          },
        });

        if (
          session &&
          new Date() <= session.expiresAt &&
          session.user.isActive
        ) {
          req.user = session.user;
        }
      } catch (error) {
        // Token invalid, but continue as unauthenticated user
      }

      next();
    } catch (error) {
      console.error("Optional auth error:", error);
      next();
    }
  }
}
