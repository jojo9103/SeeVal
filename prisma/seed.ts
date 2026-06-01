import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminName = process.env.ADMIN_NAME?.trim() || "SeeV Admin";
const adminOrganization = process.env.ADMIN_ORGANIZATION?.trim() || "SeeV";

function validateAdminConfig() {
  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }

  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(adminPassword)) {
    throw new Error(
      "ADMIN_PASSWORD must be at least 8 characters and include letters and numbers"
    );
  }
}

async function main() {
  validateAdminConfig();

  const passwordHash = await bcrypt.hash(adminPassword!, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail! },
    update: {
      name: adminName,
      organization: adminOrganization,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
    create: {
      email: adminEmail!,
      name: adminName,
      organization: adminOrganization,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  console.log(`Admin account is ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
