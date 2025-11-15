import { Request, Response } from "express";
import prisma from "../config/database";
import { PasswordUtil } from "../utils/password.util";
import { TokenUtil } from "../utils/token.util";
import { EmailUtil } from "../utils/email.util";
import { ValidatorUtil } from "../utils/validator.util";
import {
  SignupRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "../types/auth.types";

export class AuthController {
  // Signup/Register
  static async signup(req: Request<{}, {}, SignupRequest>, res: Response) {
    try {
      const {
        studentId,
        password,
        confirmPassword,
        email,
        phone,
        name,
        course,
        yearOfStudy,
      } = req.body;

      // Validation
      if (!studentId || !password || !confirmPassword || !email || !phone) {
        return res.status(400).json({
          success: false,
          message:
            "All required fields must be provided (studentId, password, confirmPassword, email, phone)",
        });
      }

      // Validate password match
      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }

      // Validate password strength
      const passwordValidation = PasswordUtil.validate(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message,
        });
      }

      // Validate student ID format
      if (!ValidatorUtil.isValidStudentId(studentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid student ID format",
        });
      }

      // Validate email
      if (!ValidatorUtil.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Validate phone
      if (!ValidatorUtil.isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid phone number format. Use format: 0712345678 or +254712345678",
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { studentId: ValidatorUtil.sanitizeInput(studentId) },
            { email: ValidatorUtil.sanitizeInput(email).toLowerCase() },
            { phone: ValidatorUtil.sanitizeInput(phone) },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.studentId === studentId) {
          return res.status(409).json({
            success: false,
            message: "User with this Student ID already exists. Please login.",
          });
        }
        if (existingUser.email === email.toLowerCase()) {
          return res.status(409).json({
            success: false,
            message: "User with this email already exists. Please login.",
          });
        }
        if (existingUser.phone === phone) {
          return res.status(409).json({
            success: false,
            message:
              "User with this phone number already exists. Please login.",
          });
        }
      }

      // Hash password
      const hashedPassword = await PasswordUtil.hash(password);

      // Check auto-verify setting
      const autoVerifySetting = await prisma.setting.findUnique({
        where: { key: "auto_verify_users" },
      });

      const autoVerify = autoVerifySetting?.value === "true";

      // Create user
      const user = await prisma.user.create({
        data: {
          studentId: ValidatorUtil.sanitizeInput(studentId),
          email: ValidatorUtil.sanitizeInput(email).toLowerCase(),
          phone: ValidatorUtil.sanitizeInput(phone),
          password: hashedPassword,
          name: name ? ValidatorUtil.sanitizeInput(name) : null,
          course: course ? ValidatorUtil.sanitizeInput(course) : null,
          yearOfStudy: yearOfStudy || null,
          emailVerified: autoVerify, // Auto-verify based on setting
          isActive: autoVerify, // Auto-activate if auto-verify is on
        },
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
          emailVerified: true,
          createdAt: true,
        },
      });

      // Generate token only if auto-verify is enabled
      let token = null;
      let expiresAt = null;

      if (autoVerify) {
        token = TokenUtil.generate({
          userId: user.id,
          studentId: user.studentId,
          role: user.role,
        });

        expiresAt = TokenUtil.getExpirationDate();

        // Create session
        await prisma.session.create({
          data: {
            userId: user.id,
            token,
            expiresAt,
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      }

      // Send welcome email (non-blocking)
      EmailUtil.sendWelcomeEmail(
        user.email,
        user.name || "",
        user.studentId
      ).catch((err) => console.error("Failed to send welcome email:", err));

      // Log activity
      await prisma.activity.create({
        data: {
          userId: user.id,
          action: "SIGNUP",
          entity: "User",
          entityId: user.id,
          description: autoVerify
            ? "User account created and auto-verified"
            : "User account created - pending verification",
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: autoVerify
          ? "Account created successfully! Welcome to BITSA Club."
          : "Registration successful! Please wait for admin verification.",
        data: {
          user,
          ...(autoVerify && { token, expiresAt }),
        },
      });
    } catch (error) {
      console.error("Signup error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred during signup. Please try again.",
      });
    }
  }

  // Login
  static async login(req: Request<{}, {}, LoginRequest>, res: Response) {
    try {
      const { studentId, password } = req.body;

      // Validation
      if (!studentId || !password) {
        return res.status(400).json({
          success: false,
          message: "Student ID and password are required",
        });
      }

      // Find user by studentId, email, or phone
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { studentId: ValidatorUtil.sanitizeInput(studentId) },
            { email: ValidatorUtil.sanitizeInput(studentId).toLowerCase() },
            { phone: ValidatorUtil.sanitizeInput(studentId) },
          ],
        },
        select: {
          id: true,
          studentId: true,
          email: true,
          phone: true,
          name: true,
          password: true,
          role: true,
          course: true,
          yearOfStudy: true,
          image: true,
          isActive: true,
          emailVerified: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User doesn't exist. Please signup first to create an account.",
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact admin.",
        });
      }

      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({
          success: false,
          message:
            "Your account is pending verification. Please wait for admin approval.",
        });
      }

      // Verify password
      const isPasswordValid = await PasswordUtil.compare(
        password,
        user.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Generate token
      const token = TokenUtil.generate({
        userId: user.id,
        studentId: user.studentId,
        role: user.role,
      });

      const expiresAt = TokenUtil.getExpirationDate();

      // Create session
      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          description: "User logged in",
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: userWithoutPassword,
          token,
          expiresAt,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred during login. Please try again.",
      });
    }
  }

  // Logout
  static async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "No token provided",
        });
      }

      // Delete session
      await prisma.session.delete({
        where: { token },
      });

      // Log activity if user is available
      if (req.user?.id) {
        await prisma.activity.create({
          data: {
            userId: req.user.id,
            action: "LOGOUT",
            entity: "User",
            entityId: req.user.id,
            description: "User logged out",
            ipAddress: req.ip,
            userAgent: req.get("user-agent") || null,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred during logout",
      });
    }
  }

  // Forgot Password
  static async forgotPassword(
    req: Request<{}, {}, ForgotPasswordRequest>,
    res: Response
  ) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      if (!ValidatorUtil.isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        return res.status(200).json({
          success: true,
          message:
            "If an account with that email exists, a password reset link has been sent.",
        });
      }

      // Generate reset token
      const resetToken = TokenUtil.generateResetToken();
      const resetTokenExpiry = TokenUtil.getResetTokenExpiry();

      // Save reset token to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });

      // Send reset email
      await EmailUtil.sendPasswordResetEmail(user.email, resetToken);

      // Log activity
      await prisma.activity.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          entity: "User",
          entityId: user.id,
          description: "Password reset requested",
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred. Please try again.",
      });
    }
  }

  // Reset Password
  static async resetPassword(
    req: Request<{}, {}, ResetPasswordRequest>,
    res: Response
  ) {
    try {
      const { token, newPassword, confirmPassword } = req.body;

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Token, new password, and confirm password are required",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }

      // Validate password strength
      const passwordValidation = PasswordUtil.validate(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: passwordValidation.message,
        });
      }

      // Find user with valid reset token
      const user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      // Hash new password
      const hashedPassword = await PasswordUtil.hash(newPassword);

      // Update password and clear reset token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      // Delete all existing sessions (force re-login)
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          userId: user.id,
          action: "PASSWORD_RESET_COMPLETED",
          entity: "User",
          entityId: user.id,
          description: "Password successfully reset",
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Password reset successfully. Please login with your new password.",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred. Please try again.",
      });
    }
  }

  // Get Current User
  static async getCurrentUser(req: Request, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
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
          bio: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (error) {
      console.error("Get current user error:", error);
      return res.status(500).json({
        success: false,
        message: "An error occurred",
      });
    }
  }
}
