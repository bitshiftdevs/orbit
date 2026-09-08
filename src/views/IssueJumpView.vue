<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type Issue } from "@/lib/api";
import { notifyError } from "@/lib/notify";

const route = useRoute();
const router = useRouter();

onMounted(async () => {
	const id = route.params.issueId as string;
	try {
		const { issue } = await api.get<{ issue: Issue & { key: string } }>(
			`/issues/${id}`,
		);
		// Issue key is "KEY-N" — pull the project key off it.
		const projectKey = issue.key.split("-")[0];
		router.replace({
			name: "project-board",
			params: { key: projectKey },
			query: { issue: id },
		});
	} catch (err) {
		notifyError(err);
		router.replace({ name: "dashboard" });
	}
});
</script>

<template>
	<div class="flex-1 grid place-items-center text-sm text-[var(--color-fg-subtle)]">
		opening issue…
	</div>
</template>
