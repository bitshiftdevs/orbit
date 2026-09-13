<script setup lang="ts">
import { Toaster } from "vue-sonner";
import { useSession } from "~/stores/session";

const session = useSession();

if (import.meta.client && session.loading) {
  session.refresh();
}
</script>

<template>
  <div>
    <Toaster theme="dark" rich-colors position="bottom-right" class="pointer-events-auto" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
