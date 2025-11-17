import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create default demo user with better-auth
  const defaultUser = await prisma.user.upsert({
    where: { email: "demo@memo-app.local" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "demo@memo-app.local",
      name: "Demo User",
      emailVerified: new Date(),
    },
  });

  // Better Auth uses scrypt for password hashing, not bcrypt
  // We need to use the Better Auth library to hash the password
  const { hashPassword } = await import("better-auth/crypto");
  const hashedPassword = await hashPassword("demo-password");

  await prisma.account.upsert({
    where: {
      providerId_accountId: {
        providerId: "credential",
        accountId: defaultUser.id,
      },
    },
    update: {
      password: hashedPassword,
    },
    create: {
      userId: defaultUser.id,
      accountId: defaultUser.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });

  console.log("Created default user:", defaultUser.email);
  console.log("Default password: demo-password");

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
