<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import FormItem from '@/components/ui/form/FormItem.vue'
import FormLabel from '@/components/ui/form/FormLabel.vue'
import { FormField, FormControl, FormMessage, FormDescription } from '@/components/ui/form'

defineProps<{ projectId: string, envVars: { id: string, key: string }[] }>()
const emit = defineEmits(['added'])
const envKey = ref('')
const envValue = ref('')
const envLoading = ref(false)

const addEnvVar = async () => {
  if (!envKey.value.trim() || !envValue.value.trim()) return
  envLoading.value = true
  try {
    const res = await fetch(`/api/projects/${projectId}/envvars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: envKey.value, value: envValue.value })
    })
    if (!res.ok) throw new Error('Failed to add env var')
    envKey.value = ''
    envValue.value = ''
    emit('added')
  } catch (e) {} finally {
    envLoading.value = false
  }
}
</script>
<template>
  <div>
    <form @submit.prevent="addEnvVar" class="mb-4 space-y-2">
      <FormField name="envKey" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Key</FormLabel>
          <FormControl>
            <Input placeholder="Key" v-bind="componentField" v-model="envKey" required />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <FormField name="envValue" v-slot="{ componentField }">
        <FormItem>
          <FormLabel>Value</FormLabel>
          <FormControl>
            <Input placeholder="Value" v-bind="componentField" v-model="envValue" required />
          </FormControl>
          <FormDescription />
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" :disabled="envLoading || !envKey.trim() || !envValue.trim()" class="bg-green-600 hover:bg-green-700">Add Env Var</Button>
    </form>
    <div v-if="envVars.length === 0" class="text-gray-400">No env vars yet.</div>
    <ul>
      <li v-for="env in envVars" :key="env.id" class="mb-1">
        <span class="font-mono">{{ env.key }}</span>
      </li>
    </ul>
  </div>
</template> 