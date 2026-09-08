import { createHmac, randomBytes } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD = 30;
const DIGITS = 6;

export function generateBase32Secret(bytes = 20): string {
	return toBase32(randomBytes(bytes));
}

export function totpCode(secret: string, at: number = Date.now()): string {
	const key = fromBase32(secret);
	const counter = Math.floor(at / 1000 / PERIOD);
	const buf = Buffer.alloc(8);
	buf.writeBigUInt64BE(BigInt(counter));
	const digest = createHmac("sha1", key).update(buf).digest();
	const offset = digest[digest.length - 1] & 0xf;
	const code =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);
	return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function verifyTotp(secret: string, token: string): boolean {
	if (!/^\d{6}$/.test(token)) return false;
	const now = Date.now();
	// Allow ±1 period drift.
	for (const drift of [-1, 0, 1]) {
		if (totpCode(secret, now + drift * PERIOD * 1000) === token) return true;
	}
	return false;
}

export function otpauthUrl(secret: string, account: string, issuer = "Orbit") {
	const params = new URLSearchParams({
		secret,
		issuer,
		algorithm: "SHA1",
		digits: String(DIGITS),
		period: String(PERIOD),
	});
	return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?${params.toString()}`;
}

export function generateBackupCodes(count = 8): string[] {
	return Array.from({ length: count }, () =>
		randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g)!.join("-"),
	);
}

function toBase32(buf: Buffer): string {
	let bits = 0;
	let value = 0;
	let out = "";
	for (let i = 0; i < buf.length; i++) {
		value = (value << 8) | buf[i];
		bits += 8;
		while (bits >= 5) {
			out += BASE32[(value >>> (bits - 5)) & 0x1f];
			bits -= 5;
		}
	}
	if (bits > 0) out += BASE32[(value << (5 - bits)) & 0x1f];
	return out;
}

function fromBase32(s: string): Buffer {
	const clean = s.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	for (const c of clean) {
		const idx = BASE32.indexOf(c);
		if (idx < 0) throw new Error(`bad base32 char: ${c}`);
		value = (value << 5) | idx;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return Buffer.from(out);
}
