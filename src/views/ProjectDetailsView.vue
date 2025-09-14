<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent } from "vue";
import { useRoute } from "vue-router";
import Card from "@/components/ui/card/Card.vue";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ref as vueRef } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Project } from "@/lib/types";
import Badge from "@/components/ui/badge/Badge.vue";

const BugsTab = defineAsyncComponent(
	() => import("./project-details/BugsTab.vue"),
);
const TodosTab = defineAsyncComponent(
	() => import("./project-details/TodosTab.vue"),
);
const SecretsTab = defineAsyncComponent(
	() => import("./project-details/SecretsTab.vue"),
);
const EnvVarsTab = defineAsyncComponent(
	() => import("./project-details/EnvVarsTab.vue"),
);
const ImagesTab = defineAsyncComponent(
	() => import("./project-details/ImagesTab.vue"),
);

const route = useRoute();
const project = ref<Project | null>(null);
const loading = ref(true);
const error = ref("");

const clientApiKey = vueRef("");
const showClientLink = vueRef(false);
const linkCopied = vueRef(false);

const baseUrl = computed(() => {
	return typeof window !== "undefined" ? window.location.origin : "";
});

const fetchProject = async () => {
	loading.value = true;
	error.value = "";
	try {
		const res = await fetch(`/api/projects/${route.params.id}`);
		if (!res.ok) throw new Error("Failed to fetch project");
		project.value = await res.json();
	} catch (e: any) {
		error.value = e.message || "Unknown error";
	} finally {
		loading.value = false;
	}
};

const generateClientLink = async () => {
	const res = await fetch(
		`/api/clients/${project.value?.client?.id}/regenerate-key/`,
		{ method: "POST" },
	);
	onmessageerror
	if (!res.ok) throw new TypeError("Failed to regenerate API key", { error: res.json() });
	clientApiKey.value = await res.text();
	showClientLink.value = true;
};

const copyLink = () => {
	const link = `${baseUrl.value}/feedback/${project.value?.id}?key=${clientApiKey.value}`;
	navigator.clipboard.writeText(link);
	linkCopied.value = true;
	setTimeout(() => {
		linkCopied.value = false;
	}, 2000);
};

onMounted(fetchProject);
</script>

<template>
	<div>
		<Card class="mb-8">
			<div class="p-6">
				<h1 class="text-3xl font-bold mb-2">{{ project?.name }}</h1>
				<div class="text-gray-400 mb-2">{{ project?.description }}</div>
				<div class="flex flex-wrap gap-2 mb-2">
					<Badge v-for="tech in project?.stack || []" :key="tech" variant="secondary">{{ tech }}</Badge>
				</div>
				<Badge variant="default">{{ project?.status }}</Badge>
			</div>
		</Card>

		<Tabs default-value="bugs">
			<TabsList class="grid w-full grid-cols-5">
				<TabsTrigger value="bugs">Bugs</TabsTrigger>
				<TabsTrigger value="todos">To-Do List</TabsTrigger>
				<TabsTrigger value="secrets">Secrets</TabsTrigger>
				<TabsTrigger value="envvars">Env Vars</TabsTrigger>
				<TabsTrigger value="images">Images</TabsTrigger>
			</TabsList>
			<TabsContent value="bugs">
				<BugsTab v-if="project" :project-id="project.id" :bugs="project.bugs" @added="fetchProject" />
			</TabsContent>
			<TabsContent value="todos">
				<TodosTab v-if="project" :project-id="project.id" :todos="project.todos" @added="fetchProject" />
			</TabsContent>
			<TabsContent value="secrets">
				<SecretsTab v-if="project" :project-id="project.id" :secrets="project.secrets" @added="fetchProject" />
			</TabsContent>
			<TabsContent value="envvars">
				<EnvVarsTab v-if="project" :project-id="project.id" :env-vars="project.envVars" @added="fetchProject" />
			</TabsContent>
			<TabsContent value="images">
				<ImagesTab v-if="project" :project-id="project.id" :images="project.images" @added="fetchProject" />
			</TabsContent>
		</Tabs>
		<div v-if="project" class="w-[400px]">
			<h2 class="text-xl font-semibold mb-4">Client Feedback</h2>
			<div class="flex items-center gap-2">
				<Button @click="generateClientLink">
					Generate Client Feedback Link
				</Button>
			</div>

			<div v-if="showClientLink" class="mt-4 p-4 bg-gray-800 rounded-lg">
				<p class="mb-2 text-sm text-gray-400">
					Share this link with your client:
				</p>
				<div class="flex items-center gap-2">
					<Input readonly :value="`${baseUrl}/feedback/${project?.id}?key=${clientApiKey}`" class="flex-1" />
					<Button @click="copyLink" class="px-2">
						<Copy v-if="!linkCopied" class="h-4 w-4" />
						<Check v-else class="h-4 w-4 text-green-500" />
					</Button>
				</div>
				<p class="mt-2 text-xs text-gray-500">
					This link includes a unique API key that allows your client to submit
					bugs and feature requests.
				</p>
			</div>
		</div>
	</div>
</template>
