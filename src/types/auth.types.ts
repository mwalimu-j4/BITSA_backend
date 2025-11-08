export interface SignupRequest {
  studentId: string;
  password: string;
  confirmPassword: string;
  email: string;
  phone: string;
  name?: string;
  course?: string;
  yearOfStudy?: number;
}

export interface LoginRequest {
  studentId: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: UserProfile;
    token: string;
    expiresAt: Date;
  };
}

export interface UserProfile {
  id: string;
  studentId: string;
  email: string;
  phone: string;
  name: string | null;
  role: string;
  course: string | null;
  yearOfStudy: number | null;
  image: string | null;
  isActive: boolean;
}
