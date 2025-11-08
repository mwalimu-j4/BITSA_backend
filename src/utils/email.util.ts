import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export class EmailUtil {
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string
  ): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: `"BITSA Club" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request - BITSA Club",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BITSA Club</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset your password for your BITSA Club account. Click the button below to reset your password:</p>
              <center>
                <a href="${resetUrl}" class="button">Reset Password</a>
              </center>
              <p>Or copy and paste this link into your browser:</p>
              <p style="background-color: #e9e9e9; padding: 10px; word-break: break-all;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request a password reset, please ignore this email or contact us if you have concerns.</p>
              <p>Best regards,<br>The BITSA Club Team</p>
            </div>
            <div class="footer">
              <p>© 2025 BITSA Club. All rights reserved.</p>
              <p>Bachelor of Information Technology Students Association</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending email:", error);
      throw new Error("Failed to send password reset email");
    }
  }

  static async sendWelcomeEmail(
    email: string,
    name: string,
    studentId: string
  ): Promise<void> {
    const mailOptions = {
      from: `"BITSA Club" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to BITSA Club! 🎉",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to BITSA Club! 🎉</h1>
            </div>
            <div class="content">
              <h2>Hello ${name || "there"}!</h2>
              <p>Welcome to the Bachelor of Information Technology Students Association (BITSA)!</p>
              <p>Your account has been successfully created with Student ID: <strong>${studentId}</strong></p>
              <p>You can now:</p>
              <ul>
                <li>Read and explore our blog posts</li>
                <li>Register for upcoming events</li>
                <li>Connect with fellow BIT students</li>
                <li>Access study resources</li>
              </ul>
              <p>Visit our website to get started: <a href="${
                process.env.FRONTEND_URL
              }">${process.env.FRONTEND_URL}</a></p>
              <p>If you have any questions, feel free to reach out to us at <a href="mailto:bitsaclub@ueab.ac.ke">bitsaclub@ueab.ac.ke</a></p>
              <p>Best regards,<br>The BITSA Club Team</p>
            </div>
            <div class="footer">
              <p>© 2025 BITSA Club. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error sending welcome email:", error);
      // Don't throw error - welcome email is not critical
    }
  }
}
