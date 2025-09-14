import { toast } from "vue-sonner";

export const showNotification = (
  message: string,
  type: "success" | "error" | "warning" | "info" = "success",
  description?: string,
) => {
  toast(message, { description, duration: 2000, type } as any);
};
