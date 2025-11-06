import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // Create default demo user
  // Note: With better-auth, users must be created through the authentication flow
  // which handles password hashing and account creation. This seed just creates
  // a user record for testing purposes. Password is managed in Account model.
  const defaultUser = await prisma.user.upsert({
    where: { id: "00000000-0000-0000-0000-000000000000" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000000",
      email: "demo@memo-app.local",
      name: "Demo User",
      emailVerified: false,
    },
  });

  console.log("Created default user:", defaultUser.email);

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
