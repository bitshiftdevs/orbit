<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Card from '@/components/ui/card/Card.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardFooter from '@/components/ui/card/CardFooter.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogHeader from '@/components/ui/dialog/DialogHeader.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import DialogFooter from '@/components/ui/dialog/DialogFooter.vue'
import { DialogDescription } from 'reka-ui'

interface Client {
  id: string
  name: string
  email: string
  company?: string
  phone?: string
  apiKey: string
}

const clients = ref<Client[]>([])
const loading = ref(true)
const error = ref('')
const showClientModal = ref(false)
const isEditing = ref(false)
const form = ref({
  id: '',
  name: '',
  email: '',
  company: '',
  phone: '',
})
const formErrors = ref({
  name: '',
  email: ''
})

const fetchClients = async () => {
  loading.value = true
  error.value = ''
  try {
      const res = await fetch('/api/clients')
    if (!res.ok) throw new Error('Failed to fetch clients')
    clients.value = await res.json()
  } catch (e: any) {
    // error.value = e.message || 'Unknown error'
    // For demo, create mock data
    clients.value = [
      {
        id: '1',
        name: 'Acme Corp',
        email: 'contact@acme.com',
        company: 'Acme Corporation',
        phone: '+1234567890',
        apiKey: 'acme_api_key_123',
      },
      {
        id: '2',
        name: 'Globex',
        email: 'info@globex.com',
        company: 'Globex Industries',
        apiKey: 'globex_api_key_456',
      },
    ]
  } finally {
    loading.value = false
  }
}

const openAddClient = () => {
  isEditing.value = false
  form.value = {
    id: '',
    name: '',
    email: '',
    company: '',
    phone: '',
  }
  formErrors.value = {
    name: '',
    email: ''
  }
  showClientModal.value = true
}

const openEditClient = (client: Client) => {
  isEditing.value = true
  form.value = {
    id: client.id,
    name: client.name,
    email: client.email,
    company: client.company || '',
    phone: client.phone || '',
  }
  formErrors.value = {
    name: '',
    email: ''
  }
  showClientModal.value = true
}

const validateForm = () => {
  let isValid = true
  formErrors.value = {
    name: '',
    email: ''
  }
  
  if (!form.value.name.trim()) {
    formErrors.value.name = 'Name is required'
    isValid = false
  }
  
  if (!form.value.email.trim()) {
    formErrors.value.email = 'Email is required'
    isValid = false
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    formErrors.value.email = 'Email is invalid'
    isValid = false
  }
  
  return isValid
}

const saveClient = async () => {
  if (!validateForm()) return
  
  try {
    // In a real app, this would call the API
    if (isEditing.value) {
      const index = clients.value.findIndex(c => c.id === form.value.id)
      if (index !== -1) {
        clients.value[index] = {
          ...clients.value[index],
          ...form.value,
        }
      }
    } else {
      const newClient: Client = {
        id: Math.random().toString(),
        name: form.value.name,
        email: form.value.email,
        company: form.value.company || undefined,
        phone: form.value.phone || undefined,
        apiKey: Math.random().toString(36).substring(2, 15),
      }
      clients.value.push(newClient)
    }
    showClientModal.value = false
  } catch (e: any) {
    alert(e.message || 'Error saving client')
  }
}

const deleteClient = async (id: string) => {
  if (!confirm('Delete this client?')) return
  try {
    // In a real app, this would call the API
    clients.value = clients.value.filter(c => c.id !== id)
  } catch (e: any) {
    alert(e.message || 'Error deleting client')
  }
}

onMounted(fetchClients)
</script>

<template>
  <div>
    <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
      <div>
        <h1 class="text-4xl font-extrabold mb-1">Clients</h1>
        <p class="text-gray-400">Manage your clients and their API keys.</p>
      </div>
      <Button class="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded shadow text-lg font-semibold" @click="openAddClient">
        + Add Client
      </Button>
    </div>
    <div>
      <div v-if="loading" class="text-gray-400">Loading clients...</div>
      <div v-else-if="error" class="text-red-400">{{ error }}</div>
      <div v-else>
        <div v-if="clients.length === 0" class="text-gray-400">No clients found.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card v-for="client in clients" :key="client.id" class="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>{{ client.name }}</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-2">
                <div>
                  <div class="text-sm text-gray-400">Email</div>
                  <div>{{ client.email }}</div>
                </div>
                <div v-if="client.company">
                  <div class="text-sm text-gray-400">Company</div>
                  <div>{{ client.company }}</div>
                </div>
                <div v-if="client.phone">
                  <div class="text-sm text-gray-400">Phone</div>
                  <div>{{ client.phone }}</div>
                </div>
                <div>
                  <div class="text-sm text-gray-400">API Key</div>
                  <div class="font-mono text-sm">{{ client.apiKey }}</div>
                </div>
              </div>
            </CardContent>
            <CardFooter class="flex justify-end gap-2">
              <Button size="sm" class="bg-yellow-600 hover:bg-yellow-700" @click="openEditClient(client)">Edit</Button>
              <Button size="sm" class="bg-red-600 hover:bg-red-700" @click="deleteClient(client.id)">Delete</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
    
    <Dialog :open="showClientModal" @update:open="showClientModal = $event">
      <DialogContent class="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>{{ isEditing ? 'Edit' : 'Add' }} Client</DialogTitle>
          <DialogDescription>
            {{ isEditing ? 'Edit' : 'Add' }} a new client to your portfolio.
          </DialogDescription>
        </DialogHeader>
        <form @submit.prevent="saveClient" class="space-y-4">
          <div class="space-y-2">
            <label for="name" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Name</label>
            <Input id="name" v-model="form.name" required placeholder="Client name" />
            <p v-if="formErrors.name" class="text-sm font-medium text-red-500">{{ formErrors.name }}</p>
          </div>
          
          <div class="space-y-2">
            <label for="email" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
            <Input id="email" v-model="form.email" required type="email" placeholder="client@example.com" />
            <p v-if="formErrors.email" class="text-sm font-medium text-red-500">{{ formErrors.email }}</p>
          </div>
          
          <div class="space-y-2">
            <label for="company" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Company (optional)</label>
            <Input id="company" v-model="form.company" placeholder="Company name" />
          </div>
          
          <div class="space-y-2">
            <label for="phone" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Phone (optional)</label>
            <Input id="phone" v-model="form.phone" placeholder="+1234567890" />
          </div>
          
          <DialogFooter class="flex gap-2 justify-end mt-6">
            <Button type="button" class="bg-gray-700 hover:bg-gray-800" @click="showClientModal = false">Cancel</Button>
            <Button type="submit" class="bg-blue-600 hover:bg-blue-700">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template> 