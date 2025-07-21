<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import Button from '@/components/ui/button/Button.vue'

defineProps<{ project: {
  id: string
  name: string
  description: string
  status: string
  stack: string[]
  images: string[]
}, showActions?: boolean }>()
const emit = defineEmits(['edit', 'delete', 'open'])
</script>
<template>
  <Card  class="bg-gray-800 rounded-xl shadow-lg hover:scale-105 transition-transform relative group">
            <CardHeader>
              <CardTitle class="flex items-center justify-between">
                <span>{{ project.name }}</span>
                <span class="text-xs px-2 py-1 rounded bg-blue-700">{{ project.status }}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div class="text-gray-400 text-sm mb-2">{{ project.description }}</div>
              <div class="flex flex-wrap gap-2 mt-2">
                <span v-for="tech in project.stack" :key="tech" class="bg-gray-700 text-xs px-2 py-1 rounded">{{ tech }}</span>
              </div>
            </CardContent>
            <CardFooter class="flex justify-between items-center">
              <router-link :to="`/projects/${project.id}`" class="text-blue-400 hover:underline">View Details</router-link>
              <div class="flex gap-2">
                <Button size="sm" class="bg-yellow-600 hover:bg-yellow-700 px-2 py-1 text-xs" @click.stop="emit('edit', project)">Edit</Button>
        <Button size="sm" class="bg-red-600 hover:bg-red-700 px-2 py-1 text-xs" @click.stop="emit('delete', project.id)">Delete</Button>
              </div>
            </CardFooter>
          </Card>
</template> 

