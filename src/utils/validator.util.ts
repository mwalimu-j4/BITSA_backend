export class ValidatorUtil {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    // Kenyan phone number format: 0712345678 or +254712345678
    const phoneRegex = /^(?:\+254|0)[17]\d{8}$/;
    return phoneRegex.test(phone.replace(/\s/g, ""));
  }

  static isValidStudentId(studentId: string): boolean {
    // Adjust this based on your institution's student ID format
    // Example: Alphanumeric, 6-12 characters
    const studentIdRegex = /^[A-Za-z0-9]{6,12}$/;
    return studentIdRegex.test(studentId);
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, "");
  }
}
