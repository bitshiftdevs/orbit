<script setup lang="ts">
import { userProfile } from '@/stores/userProfile'
</script>

<template>
  <footer class="bg-background text-muted-foreground text-sm py-4 mt-12 border-t border-border">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2 px-4">
      <div>
        &copy; {{ new Date().getFullYear() }} {{ userProfile.name }} (<span class="text-primary">@{{ userProfile.username }}</span>)
      </div>
      <div>
        Built with <span class="text-primary">Vue</span> & <span class="text-primary">Cloudflare</span>
      </div>
    </div>
  </footer>
</template> 