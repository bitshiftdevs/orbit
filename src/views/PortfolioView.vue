<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProjectCard from '@/components/ProjectCard.vue'
import Button from '@/components/ui/button/Button.vue'
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
const router = useRouter()

const fetchProjects = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/projects')
    if (!res.ok) throw new Error('Failed to fetch projects')
    projects.value = (await res.json()).filter((p: Project) => p.status === 'completed')
  } catch (e: any) {
    error.value = e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(fetchProjects)
</script>
<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-white py-12 px-4">
    <h1 class="text-4xl font-extrabold mb-8 text-center">Portfolio</h1>
    <div v-if="loading" class="text-gray-400 text-center">Loading projects...</div>
    <div v-else-if="error" class="text-red-400 text-center">{{ error }}</div>
    <div v-else-if="projects.length === 0" class="text-gray-400 text-center">No completed projects yet.</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :show-actions="false"
        @open="p => router.push(`/projects/${p.id}`)"
      />
    </div>
  </div>
</template> 