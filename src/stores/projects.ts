import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api, type Project, type SessionUser } from "@/lib/api";

export const useProjects = defineStore("projects", () => {
	const items = ref<Project[]>([]);
	const loading = ref(false);

	async function load() {
		loading.value = true;
		try {
			const { projects } = await api.get<{ projects: Project[] }>(
				"/projects",
			);
			items.value = projects;
		} finally {
			loading.value = false;
		}
	}

	async function create(input: {
		key: string;
		name: string;
		description?: string;
		color?: string;
		icon?: string;
		repoUrl?: string;
		productionUrl?: string;
		memberIds?: string[];
	}) {
		const { project } = await api.post<{ project: Project }>(
			"/projects",
			input,
		);
		items.value.unshift(project);
		return project;
	}

	async function get(idOrKey: string) {
		return api.get<{
			project: Project;
			members: Array<
				Pick<
					SessionUser,
					"id" | "name" | "handle" | "email" | "avatarUrl" | "accentColor" | "role"
				> & { joinedAt: string }
			>;
		}>(`/projects/${idOrKey}`);
	}

	const active = computed(() => (key: string) =>
		items.value.find((p) => p.key === key.toUpperCase()) ?? null,
	);

	return { items, loading, load, create, get, active };
});
