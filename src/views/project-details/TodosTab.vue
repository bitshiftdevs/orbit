<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'

defineProps<{
  projectId: string;
  todos: { id: string; description: string; status: string }[];
}>()

const emit = defineEmits(['added'])

const newTodoDescription = ref('')
const newTodoStatus = ref('todo')
const loading = ref(false)
const error = ref('')
const formError = ref('')

const addTodo = async () => {
  if (!newTodoDescription.value.trim()) {
    formError.value = 'Description is required'
    return
  }
  
  formError.value = ''
  loading.value = true
  error.value = ''
  
  try {
    const res = await fetch(`/api/projects/${projectId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: newTodoDescription.value,
        status: newTodoStatus.value
      })
    })
    
    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to add todo')
    }
    
    newTodoDescription.value = ''
    emit('added')
  } catch (e: any) {
    error.value = e.message || 'Error adding todo'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="p-6">
    <h3 class="text-lg font-semibold mb-4">To-Do List</h3>
    
    <div v-if="error" class="text-red-400 mb-4">{{ error }}</div>
    
    <form @submit.prevent="addTodo" class="mb-6">
      <div class="space-y-2">
        <label for="todo-description" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Description</label>
        <Textarea 
          id="todo-description"
          v-model="newTodoDescription"
          placeholder="Describe the task..."
          :disabled="loading"
          class="min-h-[100px]"
        />
        <p v-if="formError" class="text-sm font-medium text-red-500">{{ formError }}</p>
      </div>
      
      <div class="space-y-2 mt-4">
        <label for="todo-status" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Status</label>
        <select 
          id="todo-status"
          v-model="newTodoStatus"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 bg-gray-800 border-gray-700 text-white"
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </div>
      
      <Button type="submit" class="mt-4 bg-green-600 hover:bg-green-700" :disabled="loading">
        {{ loading ? 'Adding...' : 'Add Task' }}
      </Button>
    </form>
    
    <div v-if="todos.length === 0" class="text-gray-400">No tasks added yet.</div>
    <div v-else class="space-y-3">
      <div v-for="todo in todos" :key="todo.id" class="bg-gray-800 p-3 rounded-md">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <p>{{ todo.description }}</p>
          </div>
          <span class="text-xs px-2 py-1 rounded ml-2" :class="{
            'bg-blue-700': todo.status === 'todo',
            'bg-yellow-700': todo.status === 'in-progress',
            'bg-green-700': todo.status === 'done',
          }">{{ todo.status }}</span>
        </div>
      </div>
    </div>
  </div>
</template> 