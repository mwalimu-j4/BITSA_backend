import { UserProfile } from "./auth.types";

declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export {};
