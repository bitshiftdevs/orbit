<script setup lang="ts">
import { nextTick, watch } from "vue";
import Button from "~/components/ui/Button.vue";
import Input from "~/components/ui/Input.vue";
import { useConfirmDialog } from "~/composables/useConfirmDialog";

const { state, _submit, _cancel } = useConfirmDialog();

let inputEl: HTMLInputElement | null = null;

watch(
	() => state.open,
	async (v) => {
		if (v) {
			await nextTick();
			inputEl = document.querySelector<HTMLInputElement>("#confirm-dialog-input");
			inputEl?.focus();
		}
	},
);

function onKey(e: KeyboardEvent) {
	if (!state.open) return;
	if (e.key === "Escape") _cancel();
	if (e.key === "Enter" && !state.hasInput) _submit();
}
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
				v-if="state.open"
				class="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
				@click="_cancel"
			/>
		</Transition>
		<Transition
			enter-active-class="transition-all duration-150 ease-out"
			enter-from-class="opacity-0 translate-y-1 scale-[0.98]"
			leave-active-class="transition-all duration-100"
			leave-to-class="opacity-0 scale-[0.98]"
		>
			<div
				v-if="state.open"
				class="fixed left-1/2 top-1/2 z-[100] -translate-x-1/2 -translate-y-1/2 card glow w-[420px] max-w-[calc(100vw-2rem)] flex flex-col"
				@keydown="onKey"
			>
				<header class="px-5 pt-5 pb-3">
					<h2 class="text-base font-semibold text-[var(--color-fg)]">{{ state.title }}</h2>
					<p class="mt-1.5 text-sm text-[var(--color-fg-muted)] leading-relaxed">
						{{ state.message }}
					</p>
				</header>

				<div v-if="state.hasInput" class="px-5 pb-3 space-y-1">
					<label
						v-if="state.inputLabel"
						class="text-[11px] uppercase tracking-wider text-[var(--color-fg-subtle)]"
					>
						{{ state.inputLabel }}
					</label>
					<Input
						id="confirm-dialog-input"
						v-model="state.inputValue"
						:placeholder="state.placeholder"
						@keydown.enter="_submit"
					/>
				</div>

				<footer class="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
					<Button variant="ghost" @click="_cancel">{{ state.cancelText }}</Button>
					<Button
						:variant="state.danger ? 'danger' : 'primary'"
						@click="_submit"
					>
						{{ state.confirmText }}
					</Button>
				</footer>
			</div>
		</Transition>
	</Teleport>
</template>
