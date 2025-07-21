<script setup lang="ts">
import Header from './components/Header.vue'
import Footer from './components/Footer.vue'
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white flex flex-col">
    <Header />
    <div class="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
      <router-view />
    </div>
    <Footer />
  </div>
</template>

<style scoped>

</style>
