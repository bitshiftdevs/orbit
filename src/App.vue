<script setup lang="ts">
import { onMounted } from "vue";
import { Toaster } from "vue-sonner";
import { useSession } from "@/stores/session";

const session = useSession();
onMounted(() => {
  if (session.loading) session.refresh();
});
</script>

<template>
  <Toaster
    theme="dark"
    rich-colors
    position="bottom-right"
    class="pointer-events-auto"
  />
  <router-view />
</template>
