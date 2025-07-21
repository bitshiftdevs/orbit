<template>
  <nav class="bg-gray-950 text-white px-6 py-3 flex items-center justify-between shadow">
    <div class="flex items-center gap-4">
      <router-link to="/" class="text-2xl font-bold tracking-tight">PM<span class="text-blue-400">/Portfolio</span></router-link>
      <router-link to="/projects" class="ml-6 hover:text-blue-400" :class="{ 'text-blue-400': $route.path.startsWith('/projects') }">Projects</router-link>
      <router-link to="/about" class="ml-4 hover:text-blue-400" :class="{ 'text-blue-400': $route.path === '/about' }">About</router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
const $route = useRoute()
</script> 