import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET =
  process.env.BETTER_AUTH_SECRET || "your-super-secret-jwt-key";
const JWT_EXPIRES_IN = "7d";

export interface TokenPayload {
  userId: string;
  studentId: string;
  role: string;
}

export class TokenUtil {
  static generate(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  static verify(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  static getExpirationDate(): Date {
    const expiresIn = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    return new Date(Date.now() + expiresIn);
  }

  static getResetTokenExpiry(): Date {
    const expiresIn = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
    return new Date(Date.now() + expiresIn);
  }
}
