<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import Card from "@/components/ui/card/Card.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import BugsTab from "./project-details/BugsTab.vue";
import TodosTab from "./project-details/TodosTab.vue";
import SecretsTab from "./project-details/SecretsTab.vue";
import EnvVarsTab from "./project-details/EnvVarsTab.vue";
import ImagesTab from "./project-details/ImagesTab.vue";
import { ref as vueRef } from "vue";
import { Check, Copy } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Bug {
  id: string;
  description: string;
  status: string;
}
interface Todo {
  id: string;
  description: string;
  status: string;
}
interface Secret {
  value: string;
  key: string;
}
interface EnvVar {
  value: string;
  key: string;
}
interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  stack: string[];
  images: string[];
  bugs: Bug[];
  todos: Todo[];
  secrets: Secret[];
  envVars: EnvVar[];
}

const route = useRoute();
const project = ref<Project | null>(null);
const loading = ref(true);
const error = ref("");

const clientApiKey = vueRef("");
const showClientLink = vueRef(false);
const linkCopied = vueRef(false);

const baseUrl = computed(() => {
  return typeof window !== "undefined" ? window.location.origin : "";
});

const fetchProject = async () => {
  loading.value = true;
  error.value = "";
  try {
    const res = await fetch(`/api/projects/${route.params.id}`);
    if (!res.ok) throw new Error("Failed to fetch project");
    project.value = await res.json();
  } catch (e: any) {
    error.value = e.message || "Unknown error";
  } finally {
    loading.value = false;
  }
};

const generateClientLink = () => {
  // For demo, generate a random API key - in real app, this would be stored in the database
  const randomKey = Math.random().toString(36).substring(2, 15);
  clientApiKey.value = randomKey;
  showClientLink.value = true;
};

const copyLink = () => {
  const link = `${baseUrl.value}/feedback/${project.value?.id}?key=${clientApiKey.value}`;
  navigator.clipboard.writeText(link);
  linkCopied.value = true;
  setTimeout(() => {
    linkCopied.value = false;
  }, 2000);
};

onMounted(fetchProject);
</script>

<template>
  <div>
    <Card class="mb-8 bg-gray-900 border-gray-800">
      <div class="p-6">
        <h1 class="text-3xl font-bold mb-2">{{ project?.name }}</h1>
        <div class="text-gray-400 mb-2">{{ project?.description }}</div>
        <div class="flex flex-wrap gap-2 mb-2">
          <span
            v-for="tech in project?.stack || []"
            :key="tech"
            class="bg-gray-800 text-xs px-2 py-1 rounded"
            >{{ tech }}</span
          >
        </div>
        <span class="text-xs px-2 py-1 rounded bg-blue-700">{{
          project?.status
        }}</span>
      </div>
    </Card>
    <Tabs
      default-value="bugs"
      class="bg-gray-900 border border-gray-800 rounded-xl"
    >
      <TabsList class="flex gap-2 p-2">
        <TabsTrigger value="bugs">Bugs</TabsTrigger>
        <TabsTrigger value="todos">To-Do List</TabsTrigger>
        <TabsTrigger value="secrets">Secrets</TabsTrigger>
        <TabsTrigger value="envvars">Env Vars</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
      </TabsList>
      <TabsContent value="bugs">
        <BugsTab
          v-if="project"
          :project-id="project.id"
          :bugs="project.bugs"
          @added="fetchProject"
        />
      </TabsContent>
      <TabsContent value="todos">
        <TodosTab
          v-if="project"
          :project-id="project.id"
          :todos="project.todos"
          @added="fetchProject"
        />
      </TabsContent>
      <TabsContent value="secrets">
        <SecretsTab
          v-if="project"
          :project-id="project.id"
          :secrets="project.secrets"
          @added="fetchProject"
        />
      </TabsContent>
      <TabsContent value="envvars">
        <EnvVarsTab
          v-if="project"
          :project-id="project.id"
          :env-vars="project.envVars"
          @added="fetchProject"
        />
      </TabsContent>
      <TabsContent value="images">
        <ImagesTab
          v-if="project"
          :project-id="project.id"
          :images="project.images"
          @added="fetchProject"
        />
      </TabsContent>
    </Tabs>
    <div v-if="project" class="mt-8">
      <h2 class="text-xl font-semibold mb-4">Client Feedback</h2>
      <div class="flex items-center gap-2">
        <Button
          @click="generateClientLink"
          class="bg-blue-600 hover:bg-blue-700"
        >
          Generate Client Feedback Link
        </Button>
      </div>

      <div v-if="showClientLink" class="mt-4 p-4 bg-gray-800 rounded-lg">
        <p class="mb-2 text-sm text-gray-400">
          Share this link with your client:
        </p>
        <div class="flex items-center gap-2">
          <Input
            readonly
            :value="`${baseUrl}/feedback/${project?.id}?key=${clientApiKey}`"
            class="flex-1"
          />
          <Button @click="copyLink" class="px-2">
            <Copy v-if="!linkCopied" class="h-4 w-4" />
            <Check v-else class="h-4 w-4 text-green-500" />
          </Button>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          This link includes a unique API key that allows your client to submit
          bugs and feature requests.
        </p>
      </div>
    </div>
  </div>
</template>
