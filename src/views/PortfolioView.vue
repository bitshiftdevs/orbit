<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import { userProfile } from '@/stores/userProfile'
import { Github, Mail } from 'lucide-vue-next'

interface Project {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
}

const router = useRouter()
const projects = ref<Project[]>([])
const loading = ref(true)
const error = ref('')
const searchTerm = ref('')
const selectedTech = ref('')

const filteredProjects = computed(() => {
  return projects.value
    .filter(p => p.status === 'completed')
    .filter(p => {
      if (!searchTerm.value) return true
      return p.name.toLowerCase().includes(searchTerm.value.toLowerCase()) || 
        p.description.toLowerCase().includes(searchTerm.value.toLowerCase())
    })
    .filter(p => {
      if (!selectedTech.value) return true
      return p.stack.some(tech => tech.toLowerCase() === selectedTech.value.toLowerCase())
    })
})

const availableTechnologies = computed(() => {
  const techs = new Set<string>()
  projects.value.forEach(project => {
    project.stack.forEach(tech => techs.add(tech))
  })
  return Array.from(techs).sort()
})

const fetchProjects = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/projects')
    if (!res.ok) throw new Error('Failed to fetch projects')
    projects.value = await res.json()
  } catch (e: any) {
    error.value = e.message || 'Unknown error'
    // For demo, create mock data
    projects.value = [
      {
        id: '1',
        name: 'E-commerce Platform',
        description: 'A full-featured e-commerce platform with product management, cart, and checkout.',
        status: 'completed',
        stack: ['Vue.js', 'Tailwind CSS', 'Node.js', 'MongoDB'],
        images: ['https://placehold.co/600x400/2563eb/FFFFFF/png?text=E-commerce'],
      },
      {
        id: '2',
        name: 'Task Management App',
        description: 'A collaborative task management application with real-time updates.',
        status: 'completed',
        stack: ['Vue.js', 'Firebase', 'Tailwind CSS'],
        images: ['https://placehold.co/600x400/10b981/FFFFFF/png?text=Task+App'],
      },
      {
        id: '3',
        name: 'Weather Dashboard',
        description: 'A weather dashboard showing forecasts and historical data.',
        status: 'completed',
        stack: ['Vue.js', 'Chart.js', 'OpenWeather API'],
        images: ['https://placehold.co/600x400/6366f1/FFFFFF/png?text=Weather+App'],
      },
    ]
  } finally {
    loading.value = false
  }
}

const viewProjectDetails = (projectId: string) => {
  router.push(`/projects/${projectId}`)
}

const clearFilters = () => {
  searchTerm.value = ''
  selectedTech.value = ''
}

onMounted(fetchProjects)
</script>

<template>
  <div>
    <!-- Hero Section -->
    <div class="bg-card py-16 px-4 mb-12 rounded-xl">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-4xl md:text-5xl font-extrabold mb-4">{{ userProfile.name }}'s Portfolio</h1>
        <p class="text-xl text-muted-foreground mb-8">{{ userProfile.tagline }}</p>
        <div class="flex flex-wrap justify-center gap-4">
          <Button as="a" :href="`mailto:${userProfile.email}`" class="bg-primary hover:bg-primary/90 flex items-center gap-2">
            <Mail class="w-4 h-4" /> Contact Me
          </Button>
          <Button as="a" :href="`https://github.com/${userProfile.github}`" target="_blank" rel="noopener" variant="outline" class="flex items-center gap-2">
            <Github class="w-4 h-4" /> View GitHub
          </Button>
        </div>
      </div>
    </div>
    
    <!-- Filters -->
    <div class="mb-8">
      <div class="flex flex-col md:flex-row gap-4 mb-4">
        <div class="flex-1">
          <Input v-model="searchTerm" placeholder="Search projects..." />
        </div>
        <div class="w-full md:w-64">
          <select v-model="selectedTech" class="w-full bg-input border border-border rounded-md px-3 py-2 text-foreground">
            <option value="">All Technologies</option>
            <option v-for="tech in availableTechnologies" :key="tech" :value="tech">{{ tech }}</option>
          </select>
        </div>
        <Button @click="clearFilters" variant="outline" class="md:w-auto">Clear Filters</Button>
      </div>
    </div>
    
    <!-- Projects -->
    <div>
      <div v-if="loading" class="text-muted-foreground text-center py-12">Loading projects...</div>
      <div v-else-if="error" class="text-destructive text-center py-12">{{ error }}</div>
      <div v-else>
        <div v-if="filteredProjects.length === 0" class="text-muted-foreground text-center py-12">
          No completed projects found.
          <div v-if="searchTerm || selectedTech" class="mt-2">
            <Button @click="clearFilters" variant="outline">Clear Filters</Button>
          </div>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card v-for="project in filteredProjects" :key="project.id" class="bg-card border-border hover:border-primary transition-all overflow-hidden">
            <div v-if="project.images && project.images.length > 0" class="h-48 overflow-hidden">
              <img :src="project.images[0]" :alt="project.name" class="w-full h-full object-cover" />
            </div>
            <CardHeader>
              <CardTitle>{{ project.name }}</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-muted-foreground mb-4">{{ project.description }}</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="tech in project.stack" :key="tech" class="bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded">{{ tech }}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Button class="w-full bg-primary hover:bg-primary/90" @click="viewProjectDetails(project.id)">View Details</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
    
    <!-- Skills Section -->
    <div class="mt-16 bg-card rounded-xl p-8">
      <h2 class="text-2xl font-bold mb-6 text-center">My Skills</h2>
      <div class="flex flex-wrap justify-center gap-3">
        <div v-for="skill in userProfile.skills" :key="skill" class="bg-secondary px-4 py-2 rounded-lg text-primary font-medium">
          {{ skill }}
        </div>
      </div>
    </div>
    
    <!-- Contact CTA -->
    <div class="mt-16 text-center">
      <h2 class="text-2xl font-bold mb-4">Interested in working together?</h2>
      <p class="text-muted-foreground mb-6">I'm always open to discussing new projects and opportunities.</p>
      <Button as="a" :href="`mailto:${userProfile.email}`" size="lg" class="bg-primary hover:bg-primary/90">Get in Touch</Button>
    </div>
  </div>
</template> 