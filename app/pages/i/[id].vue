<script setup lang="ts">
import { onMounted } from "vue";
import { api, type Issue } from "~/lib/api";
import { notifyError } from "~/lib/notify";
import { useRoute, navigateTo } from "nuxt/app";

const route = useRoute();

onMounted(async () => {
	const id = route.params.issueId as string;
	try {
		const { issue } = await api.get<{ issue: Issue & { key: string } }>(
			`/issues/${id}`,
		);
		const projectKey = issue.key.split("-")[0];
		navigateTo({
			name: "project-board",
			params: { key: projectKey },
			query: { issue: id },
		});
	} catch (err) {
		notifyError(err);
		navigateTo({ name: "dashboard" });
	}
});
</script>

<template>
	<div class="flex-1 grid place-items-center text-sm text-[var(--color-fg-subtle)]">
		opening issue…
	</div>
</template>
