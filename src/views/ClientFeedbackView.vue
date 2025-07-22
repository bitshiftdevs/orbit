<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

interface Project {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
}

const route = useRoute()
const projectId = route.params.id as string
const apiKey = route.query.key as string

const project = ref<Project | null>(null)
const loading = ref(true)
const error = ref('')
const success = ref('')
const newBug = ref('')
const newTodo = ref('')
const bugLoading = ref(false)
const todoLoading = ref(false)

const fetchProject = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/projects/${projectId}`)
    if (!res.ok) throw new Error('Failed to fetch project')
    project.value = await res.json()
  } catch (e: any) {
    error.value = e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

const addBug = async () => {
  if (!newBug.value.trim() || !apiKey) return
  bugLoading.value = true
  success.value = ''
  error.value = ''
  try {
    const res = await fetch(`/api/projects/${projectId}/bugs/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newBug.value, status: 'open', apiKey })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to add bug')
    }
    newBug.value = ''
    success.value = 'Bug reported successfully!'
  } catch (e: any) {
    error.value = e.message || 'Error submitting bug'
  } finally {
    bugLoading.value = false
  }
}

const addTodo = async () => {
  if (!newTodo.value.trim() || !apiKey) return
  todoLoading.value = true
  success.value = ''
  error.value = ''
  try {
    const res = await fetch(`/api/projects/${projectId}/todos/client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newTodo.value, status: 'todo', apiKey })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to add todo')
    }
    newTodo.value = ''
    success.value = 'Todo suggestion added successfully!'
  } catch (e: any) {
    error.value = e.message || 'Error submitting todo'
  } finally {
    todoLoading.value = false
  }
}

onMounted(() => {
  if (projectId) {
    fetchProject()
  } else {
    error.value = 'No project ID provided'
  }
})
</script>
<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-white py-12 px-4">
    <div class="max-w-3xl mx-auto">
      <div v-if="loading" class="text-gray-400 text-center">Loading project...</div>
      <div v-else-if="error" class="text-red-400 text-center p-4 bg-red-900/20 rounded-lg mb-4">{{ error }}</div>
      <div v-else-if="!project" class="text-gray-400 text-center">Project not found.</div>
      <div v-else>
        <Card class="mb-8 bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>{{ project.name }}</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-gray-400 mb-2">{{ project.description }}</p>
            <div class="flex flex-wrap gap-2 mt-2">
              <span v-for="tech in project.stack" :key="tech" class="bg-gray-800 text-xs px-2 py-1 rounded">{{ tech }}</span>
            </div>
          </CardContent>
        </Card>
        
        <div v-if="success" class="text-green-400 text-center p-4 bg-green-900/20 rounded-lg mb-4">{{ success }}</div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card class="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Report a Bug</CardTitle>
            </CardHeader>
            <CardContent>
              <form @submit.prevent="addBug" class="space-y-4">
                <FormField name="bug" v-slot="{ componentField }">
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea v-bind="componentField" v-model="newBug" placeholder="Describe the bug..." required rows="3" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <Button type="submit" :disabled="bugLoading || !newBug.trim() || !apiKey" class="w-full bg-red-600 hover:bg-red-700">
                  {{ bugLoading ? 'Submitting...' : 'Submit Bug Report' }}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card class="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Suggest a Feature</CardTitle>
            </CardHeader>
            <CardContent>
              <form @submit.prevent="addTodo" class="space-y-4">
                <FormField name="todo" v-slot="{ componentField }">
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea v-bind="componentField" v-model="newTodo" placeholder="Describe your feature suggestion..." required rows="3" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <Button type="submit" :disabled="todoLoading || !newTodo.trim() || !apiKey" class="w-full bg-green-600 hover:bg-green-700">
                  {{ todoLoading ? 'Submitting...' : 'Submit Feature Suggestion' }}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
        
        <div class="mt-8 text-center text-sm text-gray-500">
          <p>This form is for authorized clients only. Your submissions are tracked with your client ID.</p>
        </div>
      </div>
    </div>
  </div>
</template> 