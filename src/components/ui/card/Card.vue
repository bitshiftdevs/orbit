<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<div data-slot="card" :class="cn(
		'bg-card text-card-foreground hover:scale-105 transition-transform flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
		props.class,
	)
		">
		<slot />
	</div>
</template>
