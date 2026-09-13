import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(pw: string) {
	return hash(pw, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function verifyPassword(pw: string, hashed: string) {
	return verify(hashed, pw);
}
