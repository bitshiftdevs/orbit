<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

defineProps<{ projectId: string, secrets: { id: string, key: string }[] }>()
const emit = defineEmits(['added'])
const secretKey = ref('')
const secretValue = ref('')
const secretLoading = ref(false)

const addSecret = async () => {
  if (!secretKey.value.trim() || !secretValue.value.trim()) return
  secretLoading.value = true
  try {
    const res = await fetch(`/api/projects/${projectId}/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: secretKey.value, value: secretValue.value })
    })
    if (!res.ok) throw new Error('Failed to add secret')
    secretKey.value = ''
    secretValue.value = ''
    emit('added')
  } catch (e) {} finally {
    secretLoading.value = false
  }
}
</script>
<template>
  <div>
    <form @submit.prevent="addSecret" class="mb-4 space-y-2">
      <FormField name="secretKey" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Key</FormLabel>
          <FormControl>
            <Input placeholder="Key" v-bind="componentField" v-model="secretKey" required />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField name="secretValue" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Value</FormLabel>
          <FormControl>
            <Input placeholder="Value" v-bind="componentField" v-model="secretValue" required />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" :disabled="secretLoading || !secretKey.trim() || !secretValue.trim()" class="bg-blue-600 hover:bg-blue-700">Add Secret</Button>
    </form>
    <div v-if="secrets.length === 0" class="text-gray-400">No secrets yet.</div>
    <ul>
      <li v-for="secret in secrets" :key="secret.id" class="mb-1">
        <span class="font-mono">{{ secret.key }}</span>
      </li>
    </ul>
  </div>
</template> 