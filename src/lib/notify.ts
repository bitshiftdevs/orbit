import { toast } from "vue-sonner";

export function notify(
	message: string,
	kind: "success" | "error" | "info" | "warning" = "success",
	description?: string,
) {
	toast(message, { description, duration: 2600, type: kind } as any);
}

export function notifyError(err: unknown) {
	const msg =
		typeof err === "object" && err && "message" in err
			? String((err as { message: string }).message)
			: "something went wrong";
	notify(msg, "error");
}
