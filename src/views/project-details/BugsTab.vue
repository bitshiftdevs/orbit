<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

defineProps<{ projectId: string, bugs: { id: string, description: string, status: string }[] }>()
const emit = defineEmits(['added'])
const newBug = ref('')
const bugLoading = ref(false)

const addBug = async () => {
  if (!newBug.value.trim()) return
  bugLoading.value = true
  try {
    const res = await fetch(`/api/projects/${projectId}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newBug.value, status: 'open' })
    })
    if (!res.ok) throw new Error('Failed to add bug')
    newBug.value = ''
    emit('added')
  } catch (e) {} finally {
    bugLoading.value = false
  }
}
</script>
<template>
  <div>
    <form @submit.prevent="addBug" class="mb-4 space-y-2">
      <FormField name="bug" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea placeholder="Describe a bug..." v-bind="componentField" v-model="newBug" required rows="2" />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" :disabled="bugLoading || !newBug.trim()" class="bg-red-600 hover:bg-red-700">Add Bug</Button>
    </form>
    <div v-if="bugs.length === 0" class="text-gray-400">No bugs yet.</div>
    <ul>
      <li v-for="bug in bugs" :key="bug.id" class="mb-1 flex items-center justify-between">
        <span>{{ bug.description }}</span>
        <span class="text-xs px-2 py-1 rounded bg-red-700">{{ bug.status }}</span>
      </li>
    </ul>
  </div>
</template> 