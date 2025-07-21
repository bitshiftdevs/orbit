<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

defineProps<{ projectId: string, todos: { id: string, description: string, status: string }[] }>()
const emit = defineEmits(['added'])
const newTodo = ref('')
const todoLoading = ref(false)

const addTodo = async () => {
  if (!newTodo.value.trim()) return
  todoLoading.value = true
  try {
    const res = await fetch(`/api/projects/${projectId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newTodo.value, status: 'todo' })
    })
    if (!res.ok) throw new Error('Failed to add todo')
    newTodo.value = ''
    emit('added')
  } catch (e) {} finally {
    todoLoading.value = false
  }
}
</script>
<template>
  <div>
    <form @submit.prevent="addTodo" class="mb-4 space-y-2">
      <FormField name="todo" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Description</FormLabel>
          <FormControl>
            <Textarea placeholder="New task..." v-bind="componentField" v-model="newTodo" required rows="2" />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" :disabled="todoLoading || !newTodo.trim()" class="bg-green-600 hover:bg-green-700">Add Todo</Button>
    </form>
    <div v-if="todos.length === 0" class="text-gray-400">No todos yet.</div>
    <ul>
      <li v-for="todo in todos" :key="todo.id" class="mb-1 flex items-center justify-between">
        <span>{{ todo.description }}</span>
        <span class="text-xs px-2 py-1 rounded bg-green-700">{{ todo.status }}</span>
      </li>
    </ul>
  </div>
</template> 