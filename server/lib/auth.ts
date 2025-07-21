import { hash, compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import type { Env, JWTPayload, AuthUser } from "../types";
import { getPrisma } from "../lib/prisma";

export async function hashPassword(password: string): Promise<string> {
  return await hash(password, 12);
}

export async function comparePassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

export function generateToken(userId: string, env: Env): string {
  return sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string, env: Env): JWTPayload | null {
  try {
    return verify(token, env.JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function getAuthHeader(c: any): string | null {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.split(" ")[1];
}

export async function getCurrentUser(
  c: any,
  env: Env,
): Promise<AuthUser | null> {
  const token = getAuthHeader(c);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token, env);
  if (!payload) {
    return null;
  }

  const prisma = getPrisma(env);

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    omit: { password: true },
  });

  return user;
}

export async function requireAuth(c: any, env: Env): Promise<AuthUser> {
  const user = await getCurrentUser(c, env);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin(c: any, env: Env): Promise<AuthUser> {
  const user = await requireAuth(c, env);
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}
