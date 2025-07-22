<script setup lang="ts">
import { userProfile } from "@/stores/userProfile";
import Avatar from "@/components/ui/avatar/Avatar.vue";
</script>

<template>
	<header class="bg-gray-950 text-white shadow px-4 py-3">
		<div class="max-w-7xl mx-auto flex items-center justify-between gap-4">
			<div class="flex items-center gap-3">
				<Avatar class="w-10 h-10">
					<img :src="userProfile.avatar" :alt="userProfile.name" class="rounded-full w-10 h-10 object-cover" />
				</Avatar>
				<div>
					<div class="font-bold text-lg leading-tight">
						{{ userProfile.name }}
					</div>
					<div class="text-xs text-gray-400 leading-tight">
						{{ userProfile.tagline }}
					</div>
				</div>
			</div>
			<nav class="flex gap-4 items-center">
				<RouterLink to="/" class="hover:text-blue-400" :class="{ 'text-blue-400 font-semibold': $route.path === '/' }">
					Home</RouterLink>
				<RouterLink to="/projects" class="hover:text-blue-400" :class="{
					'text-blue-400 font-semibold': $route.path.startsWith('/projects'),
				}">Projects</RouterLink>
				<RouterLink to="/clients" class="hover:text-blue-400" :class="{ 'text-blue-400 font-semibold': $route.path.startsWith('/clients') }">Clients</RouterLink>
				<RouterLink to="/portfolio" class="hover:text-blue-400" :class="{ 'text-blue-400 font-semibold': $route.path === '/portfolio' }">Portfolio</RouterLink>
				<RouterLink to="/about" class="hover:text-blue-400"
					:class="{ 'text-blue-400 font-semibold': $route.path === '/about' }">About</RouterLink>
			</nav>
		</div>
	</header>
</template>
