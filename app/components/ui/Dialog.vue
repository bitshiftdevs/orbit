<script setup lang="ts">
import { X } from "lucide-vue-next";
import { onMounted, onUnmounted, watch } from "vue";

const props = defineProps<{
	open: boolean;
	title?: string;
	description?: string;
	width?: string;
}>();

const emit = defineEmits<{ "update:open": [value: boolean] }>();

function close() {
	emit("update:open", false);
}

function onKey(e: KeyboardEvent) {
	if (e.key === "Escape" && props.open) close();
}

onMounted(() => document.addEventListener("keydown", onKey));
onUnmounted(() => document.removeEventListener("keydown", onKey));

watch(
	() => props.open,
	(v) => {
		document.body.style.overflow = v ? "hidden" : "";
	},
);
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-150"
			enter-from-class="opacity-0"
			leave-active-class="transition-opacity duration-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="open"
				class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
				@click="close"
			/>
		</Transition>
		<Transition
			enter-active-class="transition-all duration-150 ease-out"
			enter-from-class="opacity-0 translate-y-1 scale-[0.98]"
			leave-active-class="transition-all duration-100"
			leave-to-class="opacity-0 scale-[0.98]"
		>
			<div
				v-if="open"
				class="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 card glow max-h-[90vh] flex flex-col overflow-hidden"
				:style="{ width: width ?? '520px', maxWidth: 'calc(100vw - 2rem)' }"
			>
				<header
					v-if="title || description"
					class="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4"
				>
					<div>
						<h2 v-if="title" class="text-base font-semibold text-[var(--color-fg)]">
							{{ title }}
						</h2>
						<p v-if="description" class="mt-1 text-xs text-[var(--color-fg-muted)]">
							{{ description }}
						</p>
					</div>
					<button
						class="p-1 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel-hover)]"
						@click="close"
					>
						<X class="h-4 w-4" />
					</button>
				</header>
				<div class="flex-1 overflow-y-auto">
					<slot />
				</div>
				<footer
					v-if="$slots.footer"
					class="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3"
				>
					<slot name="footer" />
				</footer>
			</div>
		</Transition>
	</Teleport>
</template>
