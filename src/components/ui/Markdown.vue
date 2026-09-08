<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdown } from "@/lib/markdown";

const props = defineProps<{ source: string | null | undefined }>();
const html = computed(() => renderMarkdown(props.source));
</script>

<template>
	<div class="md" v-html="html" />
</template>

<style>
.md {
	color: var(--color-fg);
	font-size: 14px;
	line-height: 1.55;
}
.md h3,
.md h4,
.md h5 {
	font-weight: 600;
	color: var(--color-fg);
	margin: 1.2em 0 0.4em;
	letter-spacing: -0.01em;
}
.md h3 { font-size: 15px; }
.md h4 { font-size: 14px; }
.md h5 { font-size: 13px; color: var(--color-fg-muted); }
.md p { margin: 0.6em 0; }
.md p:first-child { margin-top: 0; }
.md a {
	color: var(--color-accent);
	text-decoration: underline;
	text-underline-offset: 2px;
	text-decoration-color: color-mix(in oklab, var(--color-accent) 40%, transparent);
}
.md a:hover { color: var(--color-accent-hover); }
.md code {
	font-family: var(--font-mono);
	font-size: 12.5px;
	padding: 1px 5px;
	border-radius: 4px;
	background: var(--color-panel-hover);
	border: 1px solid var(--color-border);
}
.md pre.code {
	font-family: var(--font-mono);
	font-size: 12.5px;
	padding: 12px 14px;
	border-radius: 8px;
	background: var(--color-bg-elevated);
	border: 1px solid var(--color-border);
	overflow-x: auto;
	margin: 0.8em 0;
	line-height: 1.5;
}
.md pre.code code {
	background: transparent;
	border: 0;
	padding: 0;
}
.md ul, .md ol {
	margin: 0.4em 0;
	padding-left: 1.2em;
}
.md li { margin: 0.2em 0; }
.md li.task {
	list-style: none;
	margin-left: -1.2em;
}
.md li.task input[type="checkbox"] {
	accent-color: var(--color-accent);
	margin-right: 6px;
	transform: translateY(1px);
}
.md blockquote {
	border-left: 2px solid var(--color-border-strong);
	padding: 0.2em 0.8em;
	margin: 0.6em 0;
	color: var(--color-fg-muted);
}
.md hr {
	border: 0;
	border-top: 1px solid var(--color-border);
	margin: 1em 0;
}
.md .mention {
	color: var(--color-accent);
	background: var(--color-accent-soft);
	padding: 0 4px;
	border-radius: 4px;
	font-weight: 500;
}
</style>
