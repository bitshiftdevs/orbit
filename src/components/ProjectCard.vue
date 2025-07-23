<script setup lang="ts">
import Card from "@/components/ui/card/Card.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import CardContent from "@/components/ui/card/CardContent.vue";
import CardFooter from "@/components/ui/card/CardFooter.vue";
import Button from "@/components/ui/button/Button.vue";
import CardDescription from "./ui/card/CardDescription.vue";
import Badge from "./ui/badge/Badge.vue";

defineProps<{
	project: {
		id: string;
		name: string;
		description: string;
		status: string;
		stack: string[];
		images: string[];
	};
	showActions?: boolean;
}>();

const emit = defineEmits(["edit", "delete", "open"]);
</script>
<template>
	<Card class="rounded-xl shadow-lg hover:scale-105 transition-transform relative group">
		<CardHeader>
			<CardTitle class="flex items-center justify-between">
				{{ project.name }}
				<Badge>{{ project.status }}</Badge>
			</CardTitle>
			<CardDescription>{{ project.description }}</CardDescription>

		</CardHeader>
		<CardContent>
			<div class="flex flex-wrap gap-2 mt-2">
				<Badge v-for="tech in project.stack" :key="tech" variant="secondary">{{ tech }}</Badge>
			</div>
		</CardContent>
		<CardFooter class="flex justify-between items-center">
			<router-link :to="`/projects/${project.id}`" class="text-blue-400 hover:underline">View Details</router-link>
			<div class="flex gap-2">
				<Button size="sm" variant="secondary"
					@click.stop="emit('edit', project)">Edit</Button>
				<Button size="sm" variant="destructive"
					@click.stop="emit('delete', project.id)">Delete</Button>
			</div>
		</CardFooter>
	</Card>
</template>
