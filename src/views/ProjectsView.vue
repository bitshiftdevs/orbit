<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import ProjectCard from '@/components/ProjectCard.vue'
import { useRouter } from 'vue-router'

interface Project {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
}

const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')
const showProjectModal = ref(false)
const isEditing = ref(false)
const form = ref({
  id: '',
  name: '',
  description: '',
  status: 'active',
  stack: '', // comma separated
  images: '', // comma separated URLs
})

const router = useRouter()

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

const openAddProject = () => {
  isEditing.value = false
  form.value = {
    id: '',
    name: '',
    description: '',
    status: 'active',
    stack: '',
    images: '',
  }
  showProjectModal.value = true
}

const openEditProject = (project: Project) => {
  isEditing.value = true
  form.value = {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    stack: project.stack.join(','),
    images: project.images.join(','),
  }
  showProjectModal.value = true
}

const saveProject = async () => {
  const payload = {
    name: form.value.name,
    description: form.value.description,
    status: form.value.status,
    stack: form.value.stack.split(',').map(s => s.trim()).filter(Boolean),
    images: form.value.images.split(',').map(s => s.trim()).filter(Boolean),
  }
  try {
    let res
    if (isEditing.value && form.value.id) {
      res = await fetch(`/api/projects/${form.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    if (!res.ok) throw new Error('Failed to save project')
    showProjectModal.value = false
    await fetchProjects()
  } catch (e: any) {
    alert(e.message || 'Error saving project')
  }
}

const deleteProject = async (id: string) => {
  if (!confirm('Delete this project?')) return
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete project')
    await fetchProjects()
  } catch (e: any) {
    alert(e.message || 'Error deleting project')
  }
}

onMounted(fetchProjects)
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
      <div>
        <h1 class="text-4xl font-extrabold mb-1">Projects</h1>
        <p class="text-gray-400">Manage and track your freelance and portfolio projects.</p>
      </div>
      <Button class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded shadow text-lg font-semibold" @click="openAddProject">
        + Add Project
      </Button>
    </div>
    <div>
      <div v-if="loading" class="text-gray-400">Loading projects...</div>
      <div v-else-if="error" class="text-red-400">{{ error }}</div>
      <div v-else>
        <div v-if="projects.length === 0" class="text-gray-400">No projects found.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <ProjectCard :project="project" v-for="project in projects" :key="project.id" @edit="openEditProject" @delete="deleteProject" @open="p => router.push(`/projects/${p.id}`)" />
        </div>
      </div>
    </div>
    <Dialog v-model:open="showProjectModal">
      <DialogContent class="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit' : 'Add' }} Project</DialogTitle>
        </DialogHeader>
        <form @submit.prevent="saveProject" class="space-y-4">
          <FormField name="name" v-slot="{ componentField }">
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input v-bind="componentField" v-model="form.name" required placeholder="Project name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField name="description" v-slot="{ componentField }">
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input v-bind="componentField" v-model="form.description" required placeholder="Project description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField name="status" v-slot="{ componentField }">
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Input v-bind="componentField" v-model="form.status" required placeholder="Status (e.g. active, completed)" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField name="stack" v-slot="{ componentField }">
            <FormItem>
              <FormLabel>Stack (comma separated)</FormLabel>
              <FormControl>
                <Input v-bind="componentField" v-model="form.stack" placeholder="e.g. Vue.js, Tailwind, Cloudflare" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField name="images" v-slot="{ componentField }">
            <FormItem>
              <FormLabel>Images (comma separated URLs)</FormLabel>
              <FormControl>
                <Input v-bind="componentField" v-model="form.images" placeholder="e.g. https://..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <DialogFooter class="flex gap-2 justify-end mt-6">
            <Button type="button" class="bg-gray-700 hover:bg-gray-800" @click="showProjectModal = false">Cancel</Button>
            <Button type="submit" class="bg-blue-600 hover:bg-blue-700">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template> 