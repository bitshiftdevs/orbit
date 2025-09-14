<script setup lang="ts">
import "vue-sonner/style.css";
import Header from "./components/Header.vue";
import Footer from "./components/Footer.vue";
import { Toaster } from "./components/ui/sonner";
</script>

<template>
	<Toaster richColors class="pointer-events-auto" />
	<div class="min-h-screen bg-background text-foreground flex flex-col">
		<Header />
		<div class="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
			<router-view />
		</div>
		<Footer />
	</div>
</template>

<style scoped></style>
