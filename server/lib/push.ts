import { inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "../db/client";
import { pushSubscriptions } from "../db/schema";

let configured = false;

function ensureConfigured() {
	if (configured) return true;
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
	if (!publicKey || !privateKey) return false;
	webpush.setVapidDetails(subject, publicKey, privateKey);
	configured = true;
	return true;
}

export type PushPayload = {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	icon?: string;
};

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
	if (!userIds.length) return;
	if (!ensureConfigured()) return;
	const db = getDb();
	const subs = await db
		.select()
		.from(pushSubscriptions)
		.where(inArray(pushSubscriptions.userId, userIds));
	if (!subs.length) return;

	const body = JSON.stringify(payload);
	const stale: string[] = [];

	await Promise.all(
		subs.map(async (s) => {
			try {
				await webpush.sendNotification(
					{ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
					body,
				);
			} catch (err: any) {
				const code = err?.statusCode;
				if (code === 404 || code === 410) stale.push(s.endpoint);
			}
		}),
	);

	if (stale.length) {
		await db
			.delete(pushSubscriptions)
			.where(inArray(pushSubscriptions.endpoint, stale))
			.catch(() => {});
	}
}
