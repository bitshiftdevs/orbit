import { onUnmounted, ref } from "vue";

export function useInlinePopover() {
	const open = ref(false);
	const triggerRef = ref<HTMLElement | null>(null);
	const popRef = ref<HTMLElement | null>(null);
	const style = ref<{ top: string; left: string; minWidth: string }>({
		top: "0px",
		left: "0px",
		minWidth: "0px",
	});

	function toggle(e?: MouseEvent) {
		e?.stopPropagation();
		if (open.value) {
			open.value = false;
			return;
		}
		const el = triggerRef.value;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		style.value = {
			top: `${rect.bottom + 4}px`,
			left: `${rect.left}px`,
			minWidth: `${Math.max(rect.width, 160)}px`,
		};
		open.value = true;
	}

	function close() {
		open.value = false;
	}

	function onPointerDown(e: PointerEvent) {
		if (!open.value) return;
		const target = e.target as Node;
		if (triggerRef.value?.contains(target)) return;
		if (popRef.value?.contains(target)) return;
		open.value = false;
	}

	if (typeof document !== "undefined") {
		document.addEventListener("pointerdown", onPointerDown);
		onUnmounted(() => document.removeEventListener("pointerdown", onPointerDown));
	}

	return { open, triggerRef, popRef, style, toggle, close };
}
