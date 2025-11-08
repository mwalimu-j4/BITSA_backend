import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create Super Admin
  const hashedPassword = await bcrypt.hash("Admin@123", 12);

  const superAdmin = await prisma.user.upsert({
    where: { studentId: "ADMIN001" },
    update: {},
    create: {
      studentId: "ADMIN001",
      email: "admin@bitsa.com",
      phone: "+254700000000",
      password: hashedPassword,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      isActive: true,
      emailVerified: true,
    },
  });

  console.log("✅ Super Admin created:", superAdmin.studentId);

  // Create sample admin
  const adminPassword = await bcrypt.hash("Admin@456", 12);

  const admin = await prisma.user.upsert({
    where: { studentId: "ADMIN002" },
    update: {},
    create: {
      studentId: "ADMIN002",
      email: "alpha@bitsa.com",
      phone: "+254708898899",
      password: adminPassword,
      name: "Alpha Chamba",
      role: "ADMIN",
      isActive: true,
      emailVerified: true,
    },
  });

  console.log("✅ Admin created:", admin.studentId);

  // Create sample student
  const studentPassword = await bcrypt.hash("Student@123", 12);

  const student = await prisma.user.upsert({
    where: { studentId: "BIT001" },
    update: {},
    create: {
      studentId: "BIT001",
      email: "student@bitsa.com",
      phone: "+254712345678",
      password: studentPassword,
      name: "Sample Student",
      role: "STUDENT",
      course: "Bachelor of Information Technology",
      yearOfStudy: 2,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log("✅ Student created:", student.studentId);

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
