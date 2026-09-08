import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";

const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(): Buffer {
	const raw = process.env.SECRETS_MASTER_KEY;
	if (!raw) throw new Error("SECRETS_MASTER_KEY is not set");
	const buf = Buffer.from(raw, "base64");
	if (buf.length !== 32) {
		throw new Error(
			`SECRETS_MASTER_KEY must decode to 32 bytes (got ${buf.length})`,
		);
	}
	return buf;
}

export function encryptSecret(plaintext: string): Buffer {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]);
}

export function decryptSecret(payload: Buffer): string {
	const iv = payload.subarray(0, IV_BYTES);
	const tag = payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
	const enc = payload.subarray(IV_BYTES + TAG_BYTES);
	const decipher = createDecipheriv("aes-256-gcm", key(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
		"utf8",
	);
}

export function sha256Hex(data: Buffer | string): string {
	return createHash("sha256").update(data).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
	const ab = Buffer.from(a, "hex");
	const bb = Buffer.from(b, "hex");
	if (ab.length !== bb.length) return false;
	return timingSafeEqual(ab, bb);
}

export function lastFour(v: string): string {
	return v.length <= 4 ? v : v.slice(-4);
}
