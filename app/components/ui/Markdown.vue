<script setup lang="ts">
import TiptapEditor from "./TiptapEditor.vue";

const props = defineProps<{ source: string | null | undefined }>();
</script>

<template>
	<TiptapEditor :model-value="props.source ?? ''" :readonly="true" />
</template>
