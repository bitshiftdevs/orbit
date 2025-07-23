<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

const { projectId, bugs } = defineProps<{
	projectId: string;
	bugs: { id: string; description: string; status: string }[];
}>()

const emit = defineEmits(['added'])

const newBugDescription = ref('')
const newBugStatus = ref('open')
const loading = ref(false)
const error = ref('')
const formError = ref('')

const addBug = async () => {
	if (!newBugDescription.value.trim()) {
		formError.value = 'Description is required'
		return
	}

	formError.value = ''
	loading.value = true
	error.value = ''

	try {
		const res = await fetch(`/api/projects/${projectId}/bugs`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				description: newBugDescription.value,
				status: newBugStatus.value
			})
		})

		if (!res.ok) {
			const errorData = await res.json()
			throw new Error(errorData.error || 'Failed to add bug')
		}

		newBugDescription.value = ''
		emit('added')
	} catch (e: any) {
		error.value = e.message || 'Error adding bug'
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<div class="p-6">
		<h3 class="text-lg font-semibold mb-4">Bugs</h3>

		<div v-if="error" class="text-red-400 mb-4">{{ error }}</div>

		<form @submit.prevent="addBug" class="mb-6">
			<div class="space-y-2">
				<label for="bug-description"
					class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Description</label>
				<Textarea id="bug-description" v-model="newBugDescription" placeholder="Describe the bug..." :disabled="loading"
					class="min-h-[100px]" />
				<p v-if="formError" class="text-sm font-medium text-red-500">{{ formError }}</p>
			</div>

			<div class="space-y-2 mt-4">
				<label for="bug-status"
					class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Status</label>
				<select id="bug-status" v-model="newBugStatus"
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-gray-800 border-gray-700 text-white">
					<option value="open">Open</option>
					<option value="in-progress">In Progress</option>
					<option value="resolved">Resolved</option>
					<option value="closed">Closed</option>
				</select>
			</div>

			<Button type="submit" class="mt-4 bg-blue-600 hover:bg-blue-700" :disabled="loading">
				{{ loading ? 'Adding...' : 'Add Bug' }}
			</Button>
		</form>

		<div v-if="bugs.length === 0" class="text-gray-400">No bugs reported yet.</div>
		<div v-else class="space-y-3">
			<div v-for="bug in bugs" :key="bug.id" class="bg-gray-800 p-3 rounded-md">
				<div class="flex justify-between items-start">
					<div class="flex-1">
						<p>{{ bug.description }}</p>
					</div>
					<span class="text-xs px-2 py-1 rounded ml-2" :class="{
						'bg-red-700': bug.status === 'open',
						'bg-yellow-700': bug.status === 'in-progress',
						'bg-green-700': bug.status === 'resolved',
						'bg-gray-700': bug.status === 'closed',
					}">{{ bug.status }}</span>
				</div>
			</div>
		</div>
	</div>
</template>
