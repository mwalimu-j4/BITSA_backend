import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config(); // ✅ Load .env file

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

cloudinary.api
  .ping()
  .then((res) => console.log("✅ Cloudinary connected:", res))
  .catch((err) => console.error("❌ Cloudinary failed:", err));
