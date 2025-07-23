<script setup lang="ts">
import Card from "@/components/ui/card/Card.vue";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import Button from "@/components/ui/button/Button.vue";
import { userProfile } from "@/stores/userProfile";
import {
	Github,
	Instagram,
	Phone,
	Mail,
	Twitter,
	MessageCircle,
	Bot,
} from "lucide-vue-next";
</script>

<template>
	<div class="flex flex-col items-center justify-center min-h-[70vh] bg-background py-12">
		<div class="flex flex-col items-center mb-8">
			<Avatar class="mb-4 w-28 h-28">
				<img :src="userProfile.avatar" :alt="userProfile.name" class="rounded-full w-28 h-28 object-cover" />
			</Avatar>
			<h1 class="text-4xl font-extrabold mb-2">{{ userProfile.name }}</h1>
			<p class="text-lg text-muted-foreground mb-2">{{ userProfile.tagline }}</p>
			<Button as="a" :href="`mailto:${userProfile.email}`" variant="outline" class="mt-2">Contact Me</Button>
		</div>
		<Card class="max-w-xl w-full bg-card border-border p-8">
			<h2 class="text-2xl font-bold mb-4">About Me</h2>
			<p class="text-foreground mb-4">
				{{ userProfile.bio }}
			</p>
			<h3 class="text-xl font-semibold mb-2">Skills</h3>
			<ul class="flex flex-wrap gap-2 mb-4">
				<li v-for="skill in userProfile.skills" :key="skill" class="bg-secondary px-3 py-1 rounded text-sm">
					{{ skill }}
				</li>
			</ul>
			<h3 class="text-xl font-semibold mb-2">Contact</h3>
			<p class="text-foreground mb-4">
				Email:
				<a :href="`mailto:${userProfile.email}`" class="text-primary hover:underline">{{ userProfile.email }}</a>
			</p>
			<h3 class="text-xl font-semibold mb-2">Socials</h3>
			<div class="flex flex-wrap gap-4 items-center">
				<a v-if="userProfile.x" :href="`https://x.com/${userProfile.x}`" target="_blank" rel="noopener"
					class="hover:text-primary flex items-center gap-1">
					<Twitter class="w-5 h-5" /> Twitter
				</a>
				<a v-if="userProfile.whatsapp" :href="`https://wa.me/${userProfile.whatsapp.replace(/\D/g, '')}`"
					target="_blank" rel="noopener" class="hover:text-primary flex items-center gap-1">
					<MessageCircle class="w-5 h-5" /> WhatsApp
				</a>
				<a v-if="userProfile.phone" :href="`tel:${userProfile.phone}`"
					class="hover:text-primary flex items-center gap-1">
					<Phone class="w-5 h-5" /> Phone
				</a>
				<a v-if="userProfile.instagram" :href="`https://instagram.com/${userProfile.instagram}`" target="_blank"
					rel="noopener" class="hover:text-primary flex items-center gap-1">
					<Instagram class="w-5 h-5" /> Instagram
				</a>
				<a v-if="userProfile.reddit" :href="`https://reddit.com/u/${userProfile.reddit}`" target="_blank" rel="noopener"
					class="hover:text-primary flex items-center gap-1">
					<Bot class="w-5 h-5" /> Bot
				</a>
				<a v-if="userProfile.github" :href="`https://github.com/${userProfile.github}`" target="_blank" rel="noopener"
					class="hover:text-foreground flex items-center gap-1">
					<Github class="w-5 h-5" /> GitHub
				</a>
			</div>
		</Card>
	</div>
</template>
