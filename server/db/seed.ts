import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { getDb } from "./client";
import { users } from "./schema";
import { hashPassword } from "../lib/auth";

const rl = createInterface({ input: stdin, output: stdout });

const name = (await rl.question("owner name: ")).trim();
const handle = (await rl.question("handle (unique, lowercase): "))
	.trim()
	.toLowerCase();
const email = (await rl.question("email: ")).trim().toLowerCase();
const password = (await rl.question("password (min 10 chars): ")).trim();
rl.close();

if (password.length < 10) {
	console.error("password must be at least 10 characters");
	process.exit(1);
}

const db = getDb();
const passwordHash = await hashPassword(password);
const [row] = await db
	.insert(users)
	.values({
		name,
		handle,
		email,
		passwordHash,
		role: "owner",
	})
	.returning();

console.log("owner created:", row.id, row.email);
process.exit(0);
