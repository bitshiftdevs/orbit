<script setup lang="ts">
import { cn } from "~/lib/utils";
import { computed } from "vue";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const props = withDefaults(
	defineProps<{
		variant?: Variant;
		size?: Size;
		type?: "button" | "submit" | "reset";
		as?: "button" | "a";
		href?: string;
		loading?: boolean;
		disabled?: boolean;
	}>(),
	{ variant: "secondary", size: "md", type: "button", as: "button" },
);

const classes = computed(() =>
	cn(
		"inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-all duration-150 select-none whitespace-nowrap",
		"disabled:opacity-50 disabled:cursor-not-allowed",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] focus-visible:ring-[var(--color-accent)]",
		{
			primary:
				"bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_10px_30px_-10px_var(--color-accent-glow)]",
			secondary:
				"bg-[var(--color-panel)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-panel-hover)] hover:border-[var(--color-border-strong)]",
			outline:
				"bg-transparent text-[var(--color-fg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-panel)]",
			ghost:
				"bg-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]",
			danger:
				"bg-[var(--color-danger)]/10 text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/20",
		}[props.variant],
		{
			sm: "h-7 px-2.5 text-xs",
			md: "h-8 px-3 text-sm",
			lg: "h-10 px-4 text-sm",
			icon: "h-8 w-8 p-0",
		}[props.size],
	),
);
</script>

<template>
	<a v-if="as === 'a'" :class="classes" :href="href">
		<slot />
	</a>
	<button
		v-else
		:class="classes"
		:type="type"
		:disabled="disabled || loading"
	>
		<span
			v-if="loading"
			class="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
		/>
		<slot />
	</button>
</template>
