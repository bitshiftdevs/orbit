<template>
  <nav class="bg-background text-foreground px-6 py-3 flex items-center justify-between shadow">
    <div class="flex items-center gap-4">
      <router-link to="/" class="text-2xl font-bold tracking-tight">PM<span class="text-primary">/Portfolio</span></router-link>
      <router-link to="/projects" class="ml-6 hover:text-primary" :class="{ 'text-primary': $route.path.startsWith('/projects') }">Projects</router-link>
      <router-link to="/about" class="ml-4 hover:text-primary" :class="{ 'text-primary': $route.path === '/about' }">About</router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
const $route = useRoute()
</script> 