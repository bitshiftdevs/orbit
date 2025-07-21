<script setup lang="ts">
import { userProfile } from '@/stores/userProfile'
</script>

<template>
  <footer class="bg-gray-950 text-gray-400 text-sm py-4 mt-12 border-t border-gray-800">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 px-4">
      <div>
        &copy; {{ new Date().getFullYear() }} {{ userProfile.name }} (<span class="text-blue-400">@{{ userProfile.username }}</span>)
      </div>
      <div>
        Built with <span class="text-blue-400">Vue</span> & <span class="text-blue-400">Cloudflare</span>
      </div>
    </div>
  </footer>
</template> 