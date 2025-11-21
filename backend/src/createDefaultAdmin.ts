// src/createDefaultAdmin.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Role } from '@prisma/client';

export async function createDefaultAdmin() {
  const prisma = new PrismaClient();

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("🔒 Users already exist — skipping default admin creation.");
    return;
  }

  console.log("🆕 No users found — creating default admin user...");

  // Generate a strong random password
  const password = crypto.randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.create({
    data: {
      email: "admin@localhost",
      name: "Default Admin",
      passwordHash,
      isAdmin: true,
      disabled: false,
    },
  });

  console.log("✅ Default admin user created:");
  console.log("   Email: admin@localhost");
  console.log(`   Password: ${password}`);
  console.log("⚠️ Save this somewhere secure — it will not be shown again!");

  // Ensure "admin" role exists
  let adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        name: "admin",
        label: "Administrator",
        description: "Full system administrator with all permissions",
      },
    });
    console.log("🔧 Created default 'admin' role.");
  }

  // Assign user to admin role
  await prisma.userRole.create({
    data: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  console.log("🔐 Assigned default admin user to 'admin' role.");
}