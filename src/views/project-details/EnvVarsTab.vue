<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import type { EnvVar } from "@/lib/types";

const { projectId, envVars } = defineProps<{
	projectId: string;
	envVars: EnvVar[];
}>();

const emit = defineEmits(["added"]);

const newEnvKey = ref("");
const newEnvValue = ref("");
const loading = ref(false);
const error = ref("");
const formErrors = ref({
	key: "",
	value: "",
});

const addEnvVar = async () => {
	// Reset form errors
	formErrors.value = { key: "", value: "" };
	let isValid = true;

	if (!newEnvKey.value.trim()) {
		formErrors.value.key = "Key is required";
		isValid = false;
	}

	if (!newEnvValue.value.trim()) {
		formErrors.value.value = "Value is required";
		isValid = false;
	}

	if (!isValid) return;

	loading.value = true;
	error.value = "";

	try {
		const res = await fetch(`/api/projects/${projectId}/envvars`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: newEnvKey.value,
				value: newEnvValue.value,
			}),
		});

		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || "Failed to add environment variable");
		}

		newEnvKey.value = "";
		newEnvValue.value = "";
		emit("added");
	} catch (e: any) {
		error.value = e.message || "Error adding environment variable";
	} finally {
		loading.value = false;
	}
};
</script>

<template>
	<div class="p-6">
		<h3 class="text-lg font-semibold mb-4">Environment Variables</h3>

		<div v-if="error" class="text-red-400 mb-4">{{ error }}</div>

		<form @submit.prevent="addEnvVar" class="mb-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="space-y-2">
					<label for="env-key"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Key</label>
					<Input id="env-key" v-model="newEnvKey" placeholder="ENV_VAR_NAME" :disabled="loading" />
					<p v-if="formErrors.key" class="text-sm font-medium text-red-500">
						{{ formErrors.key }}
					</p>
				</div>

				<div class="space-y-2">
					<label for="env-value"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Value</label>
					<Input id="env-value" v-model="newEnvValue" placeholder="Value" :disabled="loading" />
					<p v-if="formErrors.value" class="text-sm font-medium text-red-500">
						{{ formErrors.value }}
					</p>
				</div>
			</div>

			<Button type="submit" class="mt-4 bg-blue-600 hover:bg-blue-700" :disabled="loading">
				{{ loading ? "Adding..." : "Add Environment Variable" }}
			</Button>
		</form>

		<div v-if="envVars.length === 0" class="text-gray-400">
			No environment variables added yet.
		</div>
		<div v-else class="space-y-3">
			<div v-for="envVar in envVars" :key="envVar.value" class="bg-gray-800 p-3 rounded-md">
				<div class="flex justify-between items-center">
					<div class="font-mono">{{ envVar.key }}</div>
					<div>{{ envVar.value }}</div>
				</div>
			</div>
		</div>
	</div>
</template>
