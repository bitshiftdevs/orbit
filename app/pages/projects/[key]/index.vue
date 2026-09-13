<script setup lang="ts">
import { computed } from "vue";
import { useRoute, navigateTo } from "nuxt/app";

definePageMeta({ name: "project-index" });

const route = useRoute();
const key = computed(() => (route.params.key as string).toUpperCase());

// The bare /projects/:key route has no content of its own; the tabbed layout
// lives in the parent [key].vue. Redirect to the board by default.
await navigateTo({ name: "project-board", params: { key: key.value } }, { replace: true });
</script>

<template>
	<div />
</template>
