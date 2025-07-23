<script setup lang="ts">
import { ref, onMounted } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import ProjectCard from "@/components/ProjectCard.vue";
import { useRouter } from "vue-router";

interface Project {
	id: string;
	name: string;
	description: string;
	status: string;
	stack: string[];
	images: string[];
}

const projects = ref<Project[]>([]);
const loading = ref(true);
const error = ref("");
const showProjectModal = ref(false);
const isEditing = ref(false);
const form = ref({
	id: "",
	name: "",
	description: "",
	status: "active",
	stack: "", // comma separated
	images: "", // comma separated URLs
});
const formErrors = ref({
	name: "",
	description: "",
	status: "",
});

const router = useRouter();

const fetchProjects = async () => {
	loading.value = true;
	error.value = "";
	try {
		const res = await fetch("/api/projects");
		if (!res.ok) throw new Error("Failed to fetch projects");
		projects.value = await res.json();
	} catch (e: any) {
		error.value = e.message || "Unknown error";
	} finally {
		loading.value = false;
	}
};

const openAddProject = () => {
	isEditing.value = false;
	form.value = {
		id: "",
		name: "",
		description: "",
		status: "active",
		stack: "",
		images: "",
	};
	formErrors.value = {
		name: "",
		description: "",
		status: "",
	};
	showProjectModal.value = true;
};

const openEditProject = (project: Project) => {
	isEditing.value = true;
	form.value = {
		id: project.id,
		name: project.name,
		description: project.description,
		status: project.status,
		stack: project.stack.join(","),
		images: project.images.join(","),
	};
	formErrors.value = {
		name: "",
		description: "",
		status: "",
	};
	showProjectModal.value = true;
};

const validateForm = () => {
	let isValid = true;
	formErrors.value = {
		name: "",
		description: "",
		status: "",
	};

	if (!form.value.name.trim()) {
		formErrors.value.name = "Name is required";
		isValid = false;
	}

	if (!form.value.description.trim()) {
		formErrors.value.description = "Description is required";
		isValid = false;
	}

	if (!form.value.status.trim()) {
		formErrors.value.status = "Status is required";
		isValid = false;
	}

	return isValid;
};

const saveProject = async () => {
	if (!validateForm()) return;

	const payload = {
		name: form.value.name,
		description: form.value.description,
		status: form.value.status,
		stack: form.value.stack
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		images: form.value.images
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	};
	try {
		let res;
		if (isEditing.value && form.value.id) {
			res = await fetch(`/api/projects/${form.value.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
		} else {
			res = await fetch("/api/projects", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
		}
		if (!res.ok) throw new Error("Failed to save project");
		showProjectModal.value = false;
		await fetchProjects();
	} catch (e: any) {
		alert(e.message || "Error saving project");
	}
};

const deleteProject = async (id: string) => {
	if (!confirm("Delete this project?")) return;
	try {
		const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete project");
		await fetchProjects();
	} catch (e: any) {
		alert(e.message || "Error deleting project");
	}
};

onMounted(fetchProjects);
</script>

<template>
	<div>
		<div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
			<div>
				<h1 class="text-4xl font-extrabold mb-1">Projects</h1>
				<p class="text-gray-400">
					Manage and track your freelance and portfolio projects.
				</p>
			</div>
			<Button class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded shadow text-lg font-semibold"
				@click="openAddProject">
				+ Add Project
			</Button>
		</div>
		<div>
			<div v-if="loading" class="text-gray-400">Loading projects...</div>
			<div v-else-if="error" class="text-red-400">{{ error }}</div>
			<div v-else>
				<div v-if="projects.length === 0" class="text-gray-400">
					No projects found.
				</div>
				<div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					<ProjectCard :project="project" v-for="project in projects" :key="project.id" @edit="openEditProject"
						@delete="deleteProject" @open="(p) => router.push(`/projects/${p.id}`)" />
				</div>
			</div>
		</div>
		<Dialog :open="showProjectModal" @update:open="showProjectModal = $event">
			<DialogContent class="max-w-lg w-full bg-gray-950 text-white">
				<DialogHeader>
					<DialogTitle>{{ isEditing ? "Edit" : "Add" }} Project</DialogTitle>
					<DialogDescription>
						{{ isEditing ? "Edit" : "Add" }} a new project to your portfolio.
					</DialogDescription>
				</DialogHeader>
				<form @submit.prevent="saveProject" class="space-y-4">
					<div class="space-y-2">
						<label for="name"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Name</label>
						<Input id="name" v-model="form.name" required placeholder="Project name" />
						<p v-if="formErrors.name" class="text-sm font-medium text-red-500">
							{{ formErrors.name }}
						</p>
					</div>

					<div class="space-y-2">
						<label for="description"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Description</label>
						<Input id="description" v-model="form.description" required placeholder="Project description" />
						<p v-if="formErrors.description" class="text-sm font-medium text-red-500">
							{{ formErrors.description }}
						</p>
					</div>

					<div class="space-y-2">
						<label for="status"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Status</label>
						<Input id="status" v-model="form.status" required placeholder="Status (e.g. active, completed)" />
						<p v-if="formErrors.status" class="text-sm font-medium text-red-500">
							{{ formErrors.status }}
						</p>
					</div>

					<div class="space-y-2">
						<label for="stack"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Stack
							(comma separated)</label>
						<Input id="stack" v-model="form.stack" placeholder="e.g. Vue.js, Tailwind, Cloudflare" />
					</div>

					<div class="space-y-2">
						<label for="images"
							class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Images
							(comma separated URLs)</label>
						<Input id="images" v-model="form.images" placeholder="e.g. https://..." />
					</div>

					<DialogFooter class="flex gap-2 justify-end mt-6">
						<Button type="button" class="bg-gray-700 hover:bg-gray-800"
							@click="showProjectModal = false">Cancel</Button>
						<Button type="submit" class="bg-blue-600 hover:bg-blue-700">Save</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	</div>
</template>
