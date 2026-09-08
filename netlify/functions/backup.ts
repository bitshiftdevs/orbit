import type { Config } from "@netlify/functions";
import postgres from "postgres";
import { createHash, createHmac } from "node:crypto";

// Streams a logical dump of the entire public schema (INSERT statements) and
// uploads it as a single object to an S3-compatible bucket. Runs from a
// Netlify scheduled function; no external `pg_dump` binary needed.
export default async () => {
	const url = process.env.DATABASE_URL;
	const bucket = process.env.BACKUP_S3_BUCKET;
	const region = process.env.BACKUP_S3_REGION ?? "auto";
	const endpoint = process.env.BACKUP_S3_ENDPOINT; // e.g. R2: https://<acct>.r2.cloudflarestorage.com
	const accessKey = process.env.BACKUP_S3_ACCESS_KEY_ID;
	const secretKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;

	if (!url) return new Response("DATABASE_URL missing", { status: 500 });
	if (!bucket || !endpoint || !accessKey || !secretKey) {
		return new Response("backup env vars missing", { status: 500 });
	}

	const sql = postgres(url, { max: 1, prepare: false });
	try {
		const tables = await sql<{ tablename: string }[]>`
			SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
		`;
		let body = `-- orbit backup ${new Date().toISOString()}\nSET session_replication_role = replica;\n\n`;
		for (const t of tables) {
			const rows = await sql.unsafe(`SELECT * FROM "${t.tablename}"`);
			body += `-- ${t.tablename} (${rows.length} rows)\n`;
			for (const r of rows) {
				const cols = Object.keys(r).map((c) => `"${c}"`).join(", ");
				const vals = Object.values(r).map(pgLiteral).join(", ");
				body += `INSERT INTO "${t.tablename}" (${cols}) VALUES (${vals});\n`;
			}
			body += "\n";
		}
		body += "SET session_replication_role = origin;\n";

		const key = `orbit-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
		const res = await putObject({
			bucket,
			region,
			endpoint,
			accessKey,
			secretKey,
			key,
			body,
		});
		return new Response(
			JSON.stringify({ ok: res.ok, key, bytes: body.length, status: res.status }),
			{ headers: { "content-type": "application/json" } },
		);
	} finally {
		await sql.end();
	}
};

export const config: Config = {
	schedule: "@daily",
};

function pgLiteral(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "number" || typeof v === "boolean") return String(v);
	if (v instanceof Date) return `'${v.toISOString()}'`;
	if (Buffer.isBuffer(v)) return `decode('${v.toString("base64")}', 'base64')`;
	if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
	return `'${String(v).replace(/'/g, "''")}'`;
}

async function putObject(opts: {
	bucket: string;
	region: string;
	endpoint: string;
	accessKey: string;
	secretKey: string;
	key: string;
	body: string;
}) {
	const url = new URL(`/${opts.bucket}/${opts.key}`, opts.endpoint);
	const now = new Date();
	const amzDate = now
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
	const date = amzDate.slice(0, 8);
	const service = "s3";
	const host = url.host;
	const payloadHash = createHash("sha256").update(opts.body).digest("hex");
	const headers: Record<string, string> = {
		host,
		"x-amz-date": amzDate,
		"x-amz-content-sha256": payloadHash,
		"content-type": "application/sql",
	};
	const signedHeaders = Object.keys(headers).sort().join(";");
	const canonicalHeaders = Object.keys(headers)
		.sort()
		.map((k) => `${k}:${headers[k]}\n`)
		.join("");
	const canonicalRequest = [
		"PUT",
		url.pathname,
		"",
		canonicalHeaders,
		signedHeaders,
		payloadHash,
	].join("\n");
	const scope = `${date}/${opts.region}/${service}/aws4_request`;
	const stringToSign = [
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		createHash("sha256").update(canonicalRequest).digest("hex"),
	].join("\n");
	const kDate = createHmac("sha256", `AWS4${opts.secretKey}`).update(date).digest();
	const kRegion = createHmac("sha256", kDate).update(opts.region).digest();
	const kService = createHmac("sha256", kRegion).update(service).digest();
	const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
	const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
	headers.authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
	return fetch(url, { method: "PUT", headers, body: opts.body });
}
