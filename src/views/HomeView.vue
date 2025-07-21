<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import ProjectCard from '@/components/ProjectCard.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { useRouter } from 'vue-router'
import { Card } from '@/components/ui/card'

interface Project {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
  createdAt?: string
  bugs?: { id: string; description: string; status: string; projectId: string }[]
  todos?: { id: string; description: string; status: string; projectId: string }[]
}

interface Bug {
  id: string
  description: string
  status: string
  projectId: string
  project?: Project
}
interface Todo {
  id: string
  description: string
  status: string
  projectId: string
  project?: Project
}

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')
const router = useRouter()

const bugInputs = ref<Record<string, string>>({})
const todoInputs = ref<Record<string, string>>({})
const bugLoading = ref<Record<string, boolean>>({})
const todoLoading = ref<Record<string, boolean>>({})

const fetchProjects = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/projects')
    if (!res.ok) throw new Error('Failed to fetch projects')
    projects.value = await res.json()
  } catch (e: any) {
    error.value = e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

const totalProjects = computed(() => projects.value.length)
const activeProjects = computed(() => projects.value.filter(p => p.status === 'active').length)
const completedProjects = computed(() => projects.value.filter(p => p.status === 'completed').length)
const recentProjects = computed(() =>
  [...projects.value].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5)
)

const allBugs = computed(() =>
  projects.value.flatMap(p => (p.bugs || []).map(b => ({ ...b, project: p })))
)
const allTodos = computed(() =>
  projects.value.flatMap(p => (p.todos || []).map(t => ({ ...t, project: p })))
)
const recentBugs = computed(() =>
  [...allBugs.value].sort((a, b) => (b.id || '').localeCompare(a.id || '')).slice(0, 5)
)
const recentTodos = computed(() =>
  [...allTodos.value].sort((a, b) => (b.id || '').localeCompare(a.id || '')).slice(0, 5)
)

const goToAddProject = () => {
  router.push('/projects')
}

const addBug = async (projectId: string) => {
  if (!bugInputs.value[projectId]?.trim()) return
  bugLoading.value[projectId] = true
  try {
    const res = await fetch(`/api/projects/${projectId}/bugs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: bugInputs.value[projectId], status: 'open' })
    })
    if (!res.ok) throw new Error('Failed to add bug')
    bugInputs.value[projectId] = ''
    await fetchProjects()
  } catch (e) {} finally {
    bugLoading.value[projectId] = false
  }
}

const addTodo = async (projectId: string) => {
  if (!todoInputs.value[projectId]?.trim()) return
  todoLoading.value[projectId] = true
  try {
    const res = await fetch(`/api/projects/${projectId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: todoInputs.value[projectId], status: 'todo' })
    })
    if (!res.ok) throw new Error('Failed to add todo')
    todoInputs.value[projectId] = ''
    await fetchProjects()
  } catch (e) {} finally {
    todoLoading.value[projectId] = false
  }
}

onMounted(fetchProjects)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-white">
    <div class="py-12 px-4 max-w-7xl mx-auto">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10">
        <div>
          <h1 class="text-4xl font-extrabold mb-2">Dashboard</h1>
          <p class="text-gray-400">Welcome! Here’s an overview of your projects and recent activity.</p>
        </div>
        <Button class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded shadow text-lg font-semibold" @click="goToAddProject">
          + Add Project
        </Button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div class="bg-gray-900 border-gray-800 p-6 flex flex-col items-center rounded-xl">
          <div class="text-3xl font-bold">{{ totalProjects }}</div>
          <div class="text-gray-400 mt-2">Total Projects</div>
        </div>
        <div class="bg-gray-900 border-gray-800 p-6 flex flex-col items-center rounded-xl">
          <div class="text-3xl font-bold">{{ activeProjects }}</div>
          <div class="text-gray-400 mt-2">Active Projects</div>
        </div>
        <div class="bg-gray-900 border-gray-800 p-6 flex flex-col items-center rounded-xl">
          <div class="text-3xl font-bold">{{ completedProjects }}</div>
          <div class="text-gray-400 mt-2">Completed Projects</div>
        </div>
      </div>
      <div>
        <h2 class="text-2xl font-bold mb-4">Recent Projects</h2>
        <div v-if="loading" class="text-gray-400">Loading projects...</div>
        <div v-else-if="error" class="text-red-400">{{ error }}</div>
        <div v-else-if="recentProjects.length === 0" class="text-gray-400">No projects found.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <ProjectCard
            v-for="project in recentProjects"
            :key="project.id"
            :project="project"
            :show-actions="false"
            @open="p => router.push(`/projects/${p.id}`)"
          />
            
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        <div>
          <h2 class="text-xl font-bold mb-4">Recent Bugs</h2>
          <div v-if="recentBugs.length === 0" class="text-gray-400">No bugs found.</div>
          <div v-else class="space-y-4">
            <Card v-for="bug in recentBugs" :key="bug.id" class="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-800" @click="$router.push(`/projects/${bug.projectId}`)">
              <div class="p-4">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-semibold">{{ bug.description }}</span>
                  <span class="text-xs px-2 py-1 rounded bg-red-700">{{ bug.status }}</span>
                </div>
                <div class="text-xs text-gray-400">Project: {{ bug.project?.name }}</div>
              </div>
            </Card>
          </div>
        </div>
        <div>
          <h2 class="text-xl font-bold mb-4">Recent Todos</h2>
          <div v-if="recentTodos.length === 0" class="text-gray-400">No todos found.</div>
          <div v-else class="space-y-4">
            <Card v-for="todo in recentTodos" :key="todo.id" class="bg-gray-900 border-gray-800 cursor-pointer hover:bg-gray-800" @click="$router.push(`/projects/${todo.projectId}`)">
              <div class="p-4">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-semibold">{{ todo.description }}</span>
                  <span class="text-xs px-2 py-1 rounded bg-green-700">{{ todo.status }}</span>
                </div>
                <div class="text-xs text-gray-400">Project: {{ todo.project?.name }}</div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
