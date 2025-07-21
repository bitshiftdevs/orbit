import { PrismaD1 } from "@prisma/adapter-d1";
import type { Env } from "../types";
import { PrismaClient } from "@prisma-app/client";

let prisma: PrismaClient;

export function getPrisma(env: Env): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaD1(env.DB);
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
