<script setup lang="ts">
import { ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";

const { projectId, secrets } = defineProps<{
	projectId: string;
	secrets: { key: string; value: string }[];
}>();

const emit = defineEmits(["added"]);

const newSecretKey = ref("");
const newSecretValue = ref("");
const loading = ref(false);
const error = ref("");
const formErrors = ref({
	key: "",
	value: "",
});

const addSecret = async () => {
	// Reset form errors
	formErrors.value = { key: "", value: "" };
	let isValid = true;

	if (!newSecretKey.value.trim()) {
		formErrors.value.key = "Key is required";
		isValid = false;
	}

	if (!newSecretValue.value.trim()) {
		formErrors.value.value = "Value is required";
		isValid = false;
	}

	if (!isValid) return;

	loading.value = true;
	error.value = "";

	try {
		const res = await fetch(`/api/projects/${projectId}/secrets`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				key: newSecretKey.value,
				value: newSecretValue.value,
			}),
		});

		if (!res.ok) {
			const errorData = await res.json();
			throw new Error(errorData.error || "Failed to add secret");
		}

		newSecretKey.value = "";
		newSecretValue.value = "";
		emit("added");
	} catch (e: any) {
		error.value = e.message || "Error adding secret";
	} finally {
		loading.value = false;
	}
};
</script>

<template>
	<div class="p-6">
		<h3 class="text-lg font-semibold mb-4">Secrets</h3>

		<div v-if="error" class="text-red-400 mb-4">{{ error }}</div>

		<form @submit.prevent="addSecret" class="mb-6">
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="space-y-2">
					<label for="secret-key"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Key</label>
					<Input id="secret-key" v-model="newSecretKey" placeholder="SECRET_KEY" :disabled="loading" />
					<p v-if="formErrors.key" class="text-sm font-medium text-red-500">
						{{ formErrors.key }}
					</p>
				</div>

				<div class="space-y-2">
					<label for="secret-value"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Value</label>
					<Input id="secret-value" v-model="newSecretValue" type="password" placeholder="Secret value"
						:disabled="loading" />
					<p v-if="formErrors.value" class="text-sm font-medium text-red-500">
						{{ formErrors.value }}
					</p>
				</div>
			</div>

			<Button type="submit" class="mt-4 bg-purple-600 hover:bg-purple-700" :disabled="loading">
				{{ loading ? "Adding..." : "Add Secret" }}
			</Button>
		</form>

		<div v-if="secrets.length === 0" class="text-gray-400">
			No secrets added yet.
		</div>
		<div v-else class="space-y-3">
			<div v-for="secret in secrets" :key="secret.key" class="bg-gray-800 p-3 rounded-md">
				<div class="flex justify-between items-center">
					<div class="font-mono">{{ secret.key }}</div>
					<div class="text-gray-400">••••••••</div>
				</div>
			</div>
		</div>
	</div>
</template>
