<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

defineProps<{ projectId: string, images: string[] }>()
const emit = defineEmits(['added'])
const imageUrl = ref('')
const imageLoading = ref(false)

const addImage = async () => {
  if (!imageUrl.value.trim()) return
  imageLoading.value = true
  try {
    // For now, just add the URL to the images array via project update
    // In a real app, you might upload to Cloudinary and get a URL
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [...images, imageUrl.value] })
    })
    if (!res.ok) throw new Error('Failed to add image')
    imageUrl.value = ''
    emit('added')
  } catch (e) {} finally {
    imageLoading.value = false
  }
}
</script>
<template>
  <div>
    <form @submit.prevent="addImage" class="mb-4 space-y-2">
      <FormField name="imageUrl" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Image URL</FormLabel>
          <FormControl>
            <Input placeholder="https://..." v-bind="componentField" v-model="imageUrl" required />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" :disabled="imageLoading || !imageUrl.trim()" class="bg-blue-600 hover:bg-blue-700">Add Image</Button>
    </form>
    <div v-if="images.length === 0" class="text-gray-400">No images yet.</div>
    <div v-else class="flex flex-wrap gap-4">
      <img v-for="img in images" :key="img" :src="img" class="w-32 h-32 object-cover rounded shadow" />
    </div>
  </div>
</template> 