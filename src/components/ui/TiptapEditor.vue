<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Markdown as MarkdownExt } from "tiptap-markdown";
import {
	Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
	List, ListOrdered, ListChecks, Quote, Terminal, Table as TableIcon,
} from "lucide-vue-next";
import MentionList from "./MentionList.vue";

type Member = {
	id: string;
	name: string;
	handle: string;
	avatarUrl?: string | null;
	accentColor?: string | null;
};

const props = withDefaults(defineProps<{
	modelValue: string | null;
	members?: Member[];
	placeholder?: string;
	readonly?: boolean;
}>(), { members: () => [], readonly: false });

const emit = defineEmits<{ "update:modelValue": [v: string] }>();

const mentionListRef = ref<InstanceType<typeof MentionList> | null>(null);
const mentionState = ref<{
	items: Member[];
	command: (attrs: { id: string; label: string }) => void;
	clientRect: (() => DOMRect | null) | null;
} | null>(null);

const mentionStyle = computed(() => {
	const rect = mentionState.value?.clientRect?.();
	if (!rect) return { display: "none" };
	return {
		position: "fixed" as const,
		left: `${rect.left}px`,
		top: `${rect.bottom + 4}px`,
		zIndex: 9999,
	};
});

const editor = useEditor({
	extensions: [
		StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
		MarkdownExt.configure({ html: false, tightLists: true, bulletListMarker: "-" }),
		Table.configure({ resizable: false }),
		TableRow,
		TableCell,
		TableHeader,
		TaskList,
		TaskItem.configure({ nested: true }),
		Link.configure({ openOnClick: props.readonly, autolink: true }),
		Placeholder.configure({ placeholder: props.placeholder ?? "Write something…" }),
		Mention.configure({
			HTMLAttributes: { class: "mention" },
			suggestion: {
				items: ({ query }: { query: string }) =>
					(props.members ?? [])
						.filter((m) =>
							m.handle.toLowerCase().includes(query.toLowerCase()) ||
							m.name.toLowerCase().includes(query.toLowerCase()),
						)
						.slice(0, 6),
				render: () => ({
					onStart: (p: any) => { mentionState.value = p; },
					onUpdate: (p: any) => { mentionState.value = p; },
					onKeyDown: ({ event }: { event: KeyboardEvent }) => {
						if (event.key === "Escape") { mentionState.value = null; return true; }
						return mentionListRef.value?.onKeyDown(event) ?? false;
					},
					onExit: () => { mentionState.value = null; },
				}),
			},
		}),
	],
	content: props.modelValue ?? "",
	editable: !props.readonly,
	editorProps: {
		attributes: { class: "tiptap-content" },
	},
	onUpdate: ({ editor }) => {
		const md = (editor.storage as any).markdown as { getMarkdown(): string };
		emit("update:modelValue", md.getMarkdown());
	},
});

watch(() => props.modelValue, (value) => {
	if (!editor.value) return;
	const md = (editor.value.storage as any).markdown as { getMarkdown(): string };
	if (md.getMarkdown() !== value) {
		editor.value.commands.setContent(value ?? "");
	}
});

watch(() => props.readonly, (val) => editor.value?.setEditable(!val));

onBeforeUnmount(() => editor.value?.destroy());
</script>

<template>
	<div :class="['tiptap-wrap', { 'tiptap-editable': !readonly }]">
		<div v-if="!readonly" class="tiptap-toolbar">
			<button type="button" :class="{ active: editor?.isActive('bold') }" title="Bold" @click="editor?.chain().focus().toggleBold().run()">
				<Bold class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('italic') }" title="Italic" @click="editor?.chain().focus().toggleItalic().run()">
				<Italic class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('strike') }" title="Strikethrough" @click="editor?.chain().focus().toggleStrike().run()">
				<Strikethrough class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('code') }" title="Inline code" @click="editor?.chain().focus().toggleCode().run()">
				<Code class="h-3.5 w-3.5" />
			</button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: editor?.isActive('heading', { level: 1 }) }" title="Heading 1" @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()">
				<Heading1 class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('heading', { level: 2 }) }" title="Heading 2" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()">
				<Heading2 class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('heading', { level: 3 }) }" title="Heading 3" @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()">
				<Heading3 class="h-3.5 w-3.5" />
			</button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: editor?.isActive('bulletList') }" title="Bullet list" @click="editor?.chain().focus().toggleBulletList().run()">
				<List class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('orderedList') }" title="Ordered list" @click="editor?.chain().focus().toggleOrderedList().run()">
				<ListOrdered class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('taskList') }" title="Task list" @click="editor?.chain().focus().toggleTaskList().run()">
				<ListChecks class="h-3.5 w-3.5" />
			</button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: editor?.isActive('blockquote') }" title="Blockquote" @click="editor?.chain().focus().toggleBlockquote().run()">
				<Quote class="h-3.5 w-3.5" />
			</button>
			<button type="button" :class="{ active: editor?.isActive('codeBlock') }" title="Code block" @click="editor?.chain().focus().toggleCodeBlock().run()">
				<Terminal class="h-3.5 w-3.5" />
			</button>
			<span class="tiptap-sep" />
			<button type="button" title="Insert table" @click="editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()">
				<TableIcon class="h-3.5 w-3.5" />
			</button>
		</div>
		<EditorContent :editor="editor" />
	</div>
	<Teleport to="body">
		<div v-if="mentionState" :style="mentionStyle">
			<MentionList
				ref="mentionListRef"
				:items="mentionState.items"
				:command="mentionState.command"
			/>
		</div>
	</Teleport>
</template>

<style>
.tiptap-wrap {
	position: relative;
}

.tiptap-toolbar {
	display: flex;
	align-items: center;
	gap: 1px;
	padding: 4px 6px;
	border: 1px solid var(--color-border);
	border-bottom: none;
	border-radius: 6px 6px 0 0;
	background: var(--color-bg-elevated);
	flex-wrap: wrap;
}

.tiptap-toolbar button {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	border-radius: 4px;
	color: var(--color-fg-muted);
	background: transparent;
	border: none;
	cursor: pointer;
	transition: background 0.1s, color 0.1s;
}

.tiptap-toolbar button:hover {
	background: var(--color-panel-hover);
	color: var(--color-fg);
}

.tiptap-toolbar button.active {
	background: var(--color-accent-soft);
	color: var(--color-accent);
}

.tiptap-sep {
	display: inline-block;
	width: 1px;
	height: 18px;
	background: var(--color-border);
	margin: 0 3px;
	flex-shrink: 0;
}

.tiptap-editable .tiptap-content {
	border: 1px solid var(--color-border);
	border-radius: 0 0 6px 6px;
	padding: 10px 12px;
	min-height: 120px;
	outline: none;
	transition: border-color 0.15s;
	background: var(--color-bg-elevated);
}

.tiptap-editable .tiptap-content:focus {
	border-color: var(--color-accent);
}

.tiptap-content {
	color: var(--color-fg);
	font-size: 14px;
	line-height: 1.55;
}

.tiptap-content h1 { font-size: 18px; font-weight: 600; margin: 1em 0 0.4em; letter-spacing: -0.02em; }
.tiptap-content h2 { font-size: 15px; font-weight: 600; margin: 1em 0 0.4em; letter-spacing: -0.01em; }
.tiptap-content h3 { font-size: 13px; font-weight: 600; margin: 1em 0 0.4em; color: var(--color-fg-muted); }

.tiptap-content p { margin: 0.5em 0; }
.tiptap-content p:first-child { margin-top: 0; }
.tiptap-content p:last-child { margin-bottom: 0; }

.tiptap-content strong { font-weight: 600; }
.tiptap-content em { font-style: italic; }
.tiptap-content s { text-decoration: line-through; }

.tiptap-content a {
	color: var(--color-accent);
	text-decoration: underline;
	text-underline-offset: 2px;
	text-decoration-color: color-mix(in oklab, var(--color-accent) 40%, transparent);
}
.tiptap-content a:hover { color: var(--color-accent-hover); }

.tiptap-content code {
	font-family: var(--font-mono);
	font-size: 12.5px;
	padding: 1px 5px;
	border-radius: 4px;
	background: var(--color-panel-hover);
	border: 1px solid var(--color-border);
}

.tiptap-content pre {
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

.tiptap-content pre code {
	background: transparent;
	border: 0;
	padding: 0;
	font-size: inherit;
}

.tiptap-content ul,
.tiptap-content ol {
	margin: 0.4em 0;
	padding-left: 1.4em;
}

.tiptap-content ul { list-style-type: disc; }
.tiptap-content ol { list-style-type: decimal; }

.tiptap-content li { margin: 0.2em 0; }

.tiptap-content ul[data-type="taskList"] {
	list-style: none;
	padding-left: 0;
}

.tiptap-content ul[data-type="taskList"] li {
	display: flex;
	align-items: baseline;
	gap: 6px;
}

.tiptap-content ul[data-type="taskList"] li > label { flex-shrink: 0; }

.tiptap-content ul[data-type="taskList"] input[type="checkbox"] {
	accent-color: var(--color-accent);
}

.tiptap-content blockquote {
	border-left: 2px solid var(--color-border-strong);
	padding: 0.2em 0.8em;
	margin: 0.6em 0;
	color: var(--color-fg-muted);
}

.tiptap-content hr {
	border: 0;
	border-top: 1px solid var(--color-border);
	margin: 1em 0;
}

.tiptap-content table {
	border-collapse: collapse;
	width: 100%;
	margin: 0.8em 0;
	font-size: 13px;
}

.tiptap-content th,
.tiptap-content td {
	padding: 6px 10px;
	border: 1px solid var(--color-border);
	text-align: left;
	vertical-align: top;
}

.tiptap-content th {
	background: var(--color-bg-elevated);
	font-weight: 600;
}

.tiptap-content tr:nth-child(even) td {
	background: var(--color-panel-hover);
}

.tiptap-content .mention {
	color: var(--color-accent);
	background: var(--color-accent-soft);
	padding: 0 4px;
	border-radius: 4px;
	font-weight: 500;
}

.tiptap-content p.is-editor-empty:first-child::before {
	content: attr(data-placeholder);
	float: left;
	color: var(--color-fg-subtle);
	pointer-events: none;
	height: 0;
}
</style>
