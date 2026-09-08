<script setup lang="ts">
import ApiTokensSection from "@/components/settings/ApiTokensSection.vue";
import MfaSection from "@/components/settings/MfaSection.vue";
import ProfileSection from "@/components/settings/ProfileSection.vue";
</script>

<template>
	<div class="flex-1 overflow-y-auto">
		<header class="border-b border-[var(--color-border)] px-8 py-5">
			<h1 class="text-xl font-semibold tracking-tight">Settings</h1>
			<p class="text-xs text-[var(--color-fg-subtle)] mt-1">Profile · security · integrations</p>
		</header>

		<div class="p-8 max-w-3xl space-y-8">
			<ProfileSection />
			<MfaSection />
			<ApiTokensSection />
		</div>
	</div>
</template>
