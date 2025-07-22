<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

defineProps<{
  projectId: string;
  images: string[];
}>()

const emit = defineEmits(['added'])

const newImageUrl = ref('')
const loading = ref(false)
const error = ref('')
const formError = ref('')

const addImage = async () => {
  if (!newImageUrl.value.trim()) {
    formError.value = 'Image URL is required'
    return
  }
  
  if (!isValidUrl(newImageUrl.value)) {
    formError.value = 'Please enter a valid URL'
    return
  }
  
  formError.value = ''
  loading.value = true
  error.value = ''
  
  try {
    // In a real app, we would update the project with the new image URL
    // For now, we'll just emit the added event to refresh the parent component
    
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500))
    
    emit('added')
    newImageUrl.value = ''
  } catch (e: any) {
    error.value = e.message || 'Error adding image'
  } finally {
    loading.value = false
  }
}

function isValidUrl(url: string) {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}
</script>

<template>
  <div class="p-6">
    <h3 class="text-lg font-semibold mb-4">Project Images</h3>
    
    <div v-if="error" class="text-red-400 mb-4">{{ error }}</div>
    
    <form @submit.prevent="addImage" class="mb-6">
      <div class="space-y-2">
        <label for="image-url" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Image URL</label>
        <Input 
          id="image-url"
          v-model="newImageUrl"
          placeholder="https://example.com/image.jpg"
          :disabled="loading"
        />
        <p v-if="formError" class="text-sm font-medium text-red-500">{{ formError }}</p>
      </div>
      
      <Button type="submit" class="mt-4 bg-blue-600 hover:bg-blue-700" :disabled="loading">
        {{ loading ? 'Adding...' : 'Add Image' }}
      </Button>
    </form>
    
    <div v-if="images.length === 0" class="text-gray-400">No images added yet.</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="(image, index) in images" :key="index" class="relative aspect-video bg-gray-800 rounded-md overflow-hidden">
        <img :src="image" :alt="`Project image ${index + 1}`" class="w-full h-full object-cover" />
      </div>
    </div>
  </div>
</template> 