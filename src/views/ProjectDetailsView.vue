<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Card from '@/components/ui/card/Card.vue'
import Tabs from '@/components/ui/tabs/Tabs.vue'
import TabsList from '@/components/ui/tabs/TabsList.vue'
import TabsTrigger from '@/components/ui/tabs/TabsTrigger.vue'
import TabsContent from '@/components/ui/tabs/TabsContent.vue'
import BugsTab from './project-details/BugsTab.vue'
import TodosTab from './project-details/TodosTab.vue'
import SecretsTab from './project-details/SecretsTab.vue'
import EnvVarsTab from './project-details/EnvVarsTab.vue'
import ImagesTab from './project-details/ImagesTab.vue'

interface Bug { id: string; description: string; status: string }
interface Todo { id: string; description: string; status: string }
interface Secret { id: string; key: string }
interface EnvVar { id: string; key: string }
interface Project {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
  bugs: Bug[]
  todos: Todo[]
  secrets: Secret[]
  envVars: EnvVar[]
}

const route = useRoute()
const project = ref<Project | null>(null)
const loading = ref(true)
const error = ref('')

const fetchProject = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/projects/${route.params.id}`)
    if (!res.ok) throw new Error('Failed to fetch project')
    project.value = await res.json()
  } catch (e: any) {
    error.value = e.message || 'Unknown error'
  } finally {
    loading.value = false
  }
}

onMounted(fetchProject)
</script>

<template>
  <div>
    <Card class="mb-8 bg-gray-900 border-gray-800">
      <div class="p-6">
        <h1 class="text-3xl font-bold mb-2">{{ project?.name }}</h1>
        <div class="text-gray-400 mb-2">{{ project?.description }}</div>
        <div class="flex flex-wrap gap-2 mb-2">
          <span v-for="tech in project?.stack || []" :key="tech" class="bg-gray-800 text-xs px-2 py-1 rounded">{{ tech }}</span>
        </div>
        <span class="text-xs px-2 py-1 rounded bg-blue-700">{{ project?.status }}</span>
      </div>
    </Card>
    <Tabs default-value="bugs" class="bg-gray-900 border border-gray-800 rounded-xl">
      <TabsList class="flex gap-2 p-2">
        <TabsTrigger value="bugs">Bugs</TabsTrigger>
        <TabsTrigger value="todos">To-Do List</TabsTrigger>
        <TabsTrigger value="secrets">Secrets</TabsTrigger>
        <TabsTrigger value="envvars">Env Vars</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
      </TabsList>
      <TabsContent value="bugs">
        <BugsTab v-if="project" :project-id="project.id" :bugs="project.bugs" @added="fetchProject" />
      </TabsContent>
      <TabsContent value="todos">
        <TodosTab v-if="project" :project-id="project.id" :todos="project.todos" @added="fetchProject" />
      </TabsContent>
      <TabsContent value="secrets">
        <SecretsTab v-if="project" :project-id="project.id" :secrets="project.secrets" @added="fetchProject" />
      </TabsContent>
      <TabsContent value="envvars">
        <EnvVarsTab v-if="project" :project-id="project.id" :env-vars="project.envVars" @added="fetchProject" />
      </TabsContent>
      <TabsContent value="images">
        <ImagesTab v-if="project" :project-id="project.id" :images="project.images" @added="fetchProject" />
      </TabsContent>
    </Tabs>
  </div>
</template> 