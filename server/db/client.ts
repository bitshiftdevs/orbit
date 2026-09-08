import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let cachedSql: postgres.Sql | null = null;

export function getDb() {
	if (cachedDb) return cachedDb;
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");
	cachedSql = postgres(url, {
		max: 5,
		idle_timeout: 30,
		prepare: false,
		ssl: { rejectUnauthorized: false },
	});
	cachedDb = drizzle(cachedSql, { schema, casing: "snake_case" });
	return cachedDb;
}

export function getSql() {
	if (!cachedSql) getDb();
	return cachedSql!;
}

export type DB = ReturnType<typeof getDb>;
export { schema };
