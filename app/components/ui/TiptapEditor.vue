<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { Extension } from "@tiptap/core";
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
import { Image as ImageExt } from "@tiptap/extension-image";
import { Typography } from "@tiptap/extension-typography";
import { Superscript } from "@tiptap/extension-superscript";
import { Subscript } from "@tiptap/extension-subscript";
import { CharacterCount } from "@tiptap/extension-character-count";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Suggestion } from "@tiptap/suggestion";
import { Markdown as MarkdownExt } from "tiptap-markdown";
import { createLowlight, common } from "lowlight";
import {
	Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
	List, ListOrdered, ListChecks, Quote, Terminal, Table as TableIcon,
	Link2, Image as ImageIcon, Minus, Undo2, Redo2,
	Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
} from "lucide-vue-next";
import MentionList from "./MentionList.vue";
import SlashList, { type SlashItem } from "./SlashList.vue";

type Member = {
	id: string;
	name: string;
	handle: string;
	avatarUrl?: string | null;
	accentColor?: string | null;
};

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
	modelValue: string | null;
	members?: Member[];
	placeholder?: string;
	readonly?: boolean;
}>(), { members: () => [], readonly: false });

const emit = defineEmits<{ "update:modelValue": [v: string] }>();

// Mention dropdown state
const mentionListRef = ref<InstanceType<typeof MentionList> | null>(null);
const mentionState = ref<{ items: Member[]; command: (a: { id: string; label: string }) => void; clientRect: (() => DOMRect | null) | null } | null>(null);

// Slash command dropdown state
const slashListRef = ref<InstanceType<typeof SlashList> | null>(null);
const slashState = ref<{ items: SlashItem[]; command: (item: SlashItem) => void; clientRect: (() => DOMRect | null) | null } | null>(null);

// Link input state
const showLinkInput = ref(false);
const linkUrl = ref("");
const linkText = ref("");
const linkInputRef = ref<HTMLInputElement | null>(null);

// Image input state
const showImageInput = ref(false);
const imageUrl = ref("");
const imageInputRef = ref<HTMLInputElement | null>(null);

// Transaction counter for reactive active-state checks
const txCount = ref(0);

const lowlight = createLowlight(common);

// Slash command items
const SLASH_COMMANDS: SlashItem[] = [
	{ title: "Heading 1", description: "Large section heading", icon: Heading1, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run() },
	{ title: "Heading 2", description: "Medium section heading", icon: Heading2, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run() },
	{ title: "Heading 3", description: "Small section heading", icon: Heading3, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run() },
	{ title: "Bullet List", description: "Unordered list", icon: List, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
	{ title: "Numbered List", description: "Ordered list", icon: ListOrdered, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
	{ title: "Task List", description: "Checkbox list", icon: ListChecks, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
	{ title: "Blockquote", description: "Quoted text", icon: Quote, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
	{ title: "Code Block", description: "Fenced code with syntax highlight", icon: Terminal, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
	{ title: "Table", description: "3×3 table", icon: TableIcon, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
	{ title: "Divider", description: "Horizontal rule", icon: Minus, command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
	{
		title: "Link", description: "Insert a hyperlink", icon: Link2,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).run();
			showLinkInput.value = true;
			showImageInput.value = false;
			nextTick(() => linkInputRef.value?.focus());
		},
	},
	{
		title: "Image", description: "Embed an image from URL", icon: ImageIcon,
		command: ({ editor, range }) => {
			editor.chain().focus().deleteRange(range).run();
			showImageInput.value = true;
			nextTick(() => imageInputRef.value?.focus());
		},
	},
];

const SlashCommandExt = Extension.create({
	name: "slashCommand",
	addProseMirrorPlugins() {
		return [
			Suggestion({
				editor: this.editor,
				char: "/",
				allowSpaces: false,
				command: ({ editor, range, props: p }: any) => p.command({ editor, range }),
				items: ({ query }: { query: string }) => {
					const q = query.toLowerCase();
					return SLASH_COMMANDS.filter((c) => c.title.toLowerCase().includes(q));
				},
				render: () => ({
					onStart: (p: any) => { slashState.value = p; },
					onUpdate: (p: any) => { slashState.value = p; },
					onKeyDown: ({ event }: { event: KeyboardEvent }) => {
						if (event.key === "Escape") { slashState.value = null; return true; }
						return slashListRef.value?.onKeyDown(event) ?? false;
					},
					onExit: () => { slashState.value = null; },
				}),
			}),
		];
	},
});

const editor = useEditor({
	extensions: [
		StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, link: false }),
		MarkdownExt.configure({ html: false, tightLists: true, bulletListMarker: "-" }),
		CodeBlockLowlight.configure({ lowlight }),
		Table.configure({ resizable: false }),
		TableRow,
		TableCell,
		TableHeader,
		TaskList,
		TaskItem.configure({ nested: true }),
		Link.configure({ openOnClick: props.readonly, autolink: true }),
		ImageExt,
		Typography,
		Superscript,
		Subscript,
		CharacterCount,
		Placeholder.configure({ placeholder: props.placeholder ?? "Write something… or type / for commands" }),
		Mention.configure({
			HTMLAttributes: { class: "mention" },
			suggestion: {
				items: ({ query }: { query: string }) =>
					(props.members ?? [])
						.filter((m) => m.handle.toLowerCase().includes(query.toLowerCase()) || m.name.toLowerCase().includes(query.toLowerCase()))
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
		SlashCommandExt,
	],
	content: props.modelValue ?? "",
	editable: !props.readonly,
	editorProps: { attributes: { class: "tiptap-content" } },
	onUpdate: ({ editor: ed }) => {
		const md = (ed.storage as any).markdown as { getMarkdown(): string };
		emit("update:modelValue", md.getMarkdown());
	},
	onTransaction: () => { txCount.value++; },
});

// Reactive active state (needs txCount to re-evaluate on cursor/selection changes)
const active = computed(() => {
	txCount.value;
	const ed = editor.value;
	if (!ed) return {} as Record<string, boolean>;
	return {
		bold: ed.isActive("bold"),
		italic: ed.isActive("italic"),
		strike: ed.isActive("strike"),
		code: ed.isActive("code"),
		superscript: ed.isActive("superscript"),
		subscript: ed.isActive("subscript"),
		h1: ed.isActive("heading", { level: 1 }),
		h2: ed.isActive("heading", { level: 2 }),
		h3: ed.isActive("heading", { level: 3 }),
		bulletList: ed.isActive("bulletList"),
		orderedList: ed.isActive("orderedList"),
		taskList: ed.isActive("taskList"),
		blockquote: ed.isActive("blockquote"),
		codeBlock: ed.isActive("codeBlock"),
		link: ed.isActive("link"),
		table: ed.isActive("tableCell") || ed.isActive("tableHeader"),
	};
});

const charCount = computed(() => {
	txCount.value;
	return (editor.value?.storage as any)?.characterCount?.characters() ?? 0;
});

const wordCount = computed(() => {
	txCount.value;
	return (editor.value?.storage as any)?.characterCount?.words() ?? 0;
});

const mentionStyle = computed(() => {
	const rect = mentionState.value?.clientRect?.();
	if (!rect) return { display: "none" };
	return { position: "fixed" as const, left: `${rect.left}px`, top: `${rect.bottom + 4}px`, zIndex: 9999 };
});

const slashStyle = computed(() => {
	const rect = slashState.value?.clientRect?.();
	if (!rect) return { display: "none" };
	return { position: "fixed" as const, left: `${rect.left}px`, top: `${rect.bottom + 4}px`, zIndex: 9999 };
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

function openLinkInput() {
	const ed = editor.value;
	const { from, to } = ed?.state.selection ?? { from: 0, to: 0 };
	linkText.value = ed?.state.doc.textBetween(from, to, " ") ?? "";
	linkUrl.value = ed?.getAttributes("link").href ?? "";
	showLinkInput.value = true;
	showImageInput.value = false;
	nextTick(() => linkInputRef.value?.focus());
}

function applyLink() {
	const ed = editor.value;
	const url = linkUrl.value.trim();
	const text = linkText.value.trim();

	const clearLinkMark = ({ tr, state }: any) => {
		tr.removeStoredMark(state.schema.marks.link);
		return true;
	};

	if (!url) {
		ed?.chain().focus().unsetLink().run();
	} else {
		const { from, to } = ed?.state.selection ?? { from: 0, to: 0 };
		const hasSelection = from !== to;
		if (hasSelection) {
			ed?.chain().focus().setLink({ href: url }).command(clearLinkMark).run();
		} else {
			ed?.chain().focus()
				.insertContent({ type: "text", text: text || url, marks: [{ type: "link", attrs: { href: url } }] })
				.command(clearLinkMark)
				.run();
		}
	}

	showLinkInput.value = false;
	linkUrl.value = "";
	linkText.value = "";
}

function openImageInput() {
	showImageInput.value = true;
	showLinkInput.value = false;
	nextTick(() => imageInputRef.value?.focus());
}

function applyImage() {
	if (imageUrl.value.trim()) {
		editor.value?.chain().focus().setImage({ src: imageUrl.value.trim() }).run();
	}
	showImageInput.value = false;
	imageUrl.value = "";
}
</script>

<template>
	<div v-bind="$attrs" :class="['tiptap-wrap', { 'tiptap-editable': !readonly }]">
		<!-- Main toolbar -->
		<div v-if="!readonly" class="tiptap-toolbar">
			<button type="button" title="Undo" :disabled="!editor?.can().undo()" @click="editor?.chain().focus().undo().run()">
				<Undo2 class="h-3.5 w-3.5" />
			</button>
			<button type="button" title="Redo" :disabled="!editor?.can().redo()" @click="editor?.chain().focus().redo().run()">
				<Redo2 class="h-3.5 w-3.5" />
			</button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: active.bold }" title="Bold" @click="editor?.chain().focus().toggleBold().run()"><Bold class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.italic }" title="Italic" @click="editor?.chain().focus().toggleItalic().run()"><Italic class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.strike }" title="Strikethrough" @click="editor?.chain().focus().toggleStrike().run()"><Strikethrough class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.superscript }" title="Superscript" @click="editor?.chain().focus().toggleSuperscript().run()"><SuperscriptIcon class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.subscript }" title="Subscript" @click="editor?.chain().focus().toggleSubscript().run()"><SubscriptIcon class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.code }" title="Inline code" @click="editor?.chain().focus().toggleCode().run()"><Code class="h-3.5 w-3.5" /></button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: active.h1 }" title="Heading 1" @click="editor?.chain().focus().toggleHeading({ level: 1 }).run()"><Heading1 class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.h2 }" title="Heading 2" @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"><Heading2 class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.h3 }" title="Heading 3" @click="editor?.chain().focus().toggleHeading({ level: 3 }).run()"><Heading3 class="h-3.5 w-3.5" /></button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: active.bulletList }" title="Bullet list" @click="editor?.chain().focus().toggleBulletList().run()"><List class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.orderedList }" title="Ordered list" @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.taskList }" title="Task list" @click="editor?.chain().focus().toggleTaskList().run()"><ListChecks class="h-3.5 w-3.5" /></button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: active.blockquote }" title="Blockquote" @click="editor?.chain().focus().toggleBlockquote().run()"><Quote class="h-3.5 w-3.5" /></button>
			<button type="button" :class="{ active: active.codeBlock }" title="Code block" @click="editor?.chain().focus().toggleCodeBlock().run()"><Terminal class="h-3.5 w-3.5" /></button>
			<button type="button" title="Horizontal rule" @click="editor?.chain().focus().setHorizontalRule().run()"><Minus class="h-3.5 w-3.5" /></button>
			<span class="tiptap-sep" />
			<button type="button" :class="{ active: active.link }" title="Link" @click="openLinkInput"><Link2 class="h-3.5 w-3.5" /></button>
			<button type="button" title="Image" @click="openImageInput"><ImageIcon class="h-3.5 w-3.5" /></button>
			<button type="button" title="Insert table" @click="editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"><TableIcon class="h-3.5 w-3.5" /></button>
		</div>

		<!-- Link input bar -->
		<div v-if="showLinkInput && !readonly" class="tiptap-input-bar">
			<input
				ref="linkInputRef"
				v-model="linkUrl"
				placeholder="URL…"
				class="tiptap-input-bar__field"
				@keydown.enter.prevent="applyLink"
				@keydown.escape="showLinkInput = false"
			/>
			<input
				v-model="linkText"
				placeholder="Link text…"
				class="tiptap-input-bar__field"
				@keydown.enter.prevent="applyLink"
				@keydown.escape="showLinkInput = false"
			/>
			<button class="tiptap-input-bar__btn primary" @click="applyLink">Apply</button>
			<button v-if="active.link" class="tiptap-input-bar__btn" @click="editor?.chain().focus().unsetLink().run(); showLinkInput = false">Remove</button>
			<button class="tiptap-input-bar__btn" @click="showLinkInput = false">Cancel</button>
		</div>

		<!-- Image input bar -->
		<div v-if="showImageInput && !readonly" class="tiptap-input-bar">
			<input
				ref="imageInputRef"
				v-model="imageUrl"
				placeholder="Image URL…"
				class="tiptap-input-bar__field"
				@keydown.enter.prevent="applyImage"
				@keydown.escape="showImageInput = false"
			/>
			<button class="tiptap-input-bar__btn primary" @click="applyImage">Insert</button>
			<button class="tiptap-input-bar__btn" @click="showImageInput = false">Cancel</button>
		</div>

		<!-- Table context bar -->
		<div v-if="active.table && !readonly" class="tiptap-table-bar">
			<span class="text-[10px] text-[var(--color-fg-subtle)] mr-1 uppercase tracking-wide">Table</span>
			<span class="tiptap-sep" />
			<button type="button" title="Add column before" @click="editor?.chain().focus().addColumnBefore().run()">← Col</button>
			<button type="button" title="Add column after" @click="editor?.chain().focus().addColumnAfter().run()">Col →</button>
			<button type="button" title="Delete column" @click="editor?.chain().focus().deleteColumn().run()">– Col</button>
			<span class="tiptap-sep" />
			<button type="button" title="Add row above" @click="editor?.chain().focus().addRowBefore().run()">↑ Row</button>
			<button type="button" title="Add row below" @click="editor?.chain().focus().addRowAfter().run()">Row ↓</button>
			<button type="button" title="Delete row" @click="editor?.chain().focus().deleteRow().run()">– Row</button>
			<span class="tiptap-sep" />
			<button type="button" class="danger" title="Delete table" @click="editor?.chain().focus().deleteTable().run()">Delete Table</button>
		</div>

		<EditorContent :editor="editor" />

		<!-- Character count -->
		<div v-if="!readonly" class="tiptap-footer">
			{{ charCount }} chars · {{ wordCount }} words
		</div>
	</div>

	<!-- Mention dropdown -->
	<Teleport to="body">
		<div v-if="mentionState" :style="mentionStyle">
			<MentionList ref="mentionListRef" :items="mentionState.items" :command="mentionState.command" />
		</div>
	</Teleport>

	<!-- Slash command dropdown -->
	<Teleport to="body">
		<div v-if="slashState" :style="slashStyle">
			<SlashList ref="slashListRef" :items="slashState.items" :command="(item) => { slashState?.command(item); slashState = null }" />
		</div>
	</Teleport>
</template>

<style>
.tiptap-wrap { position: relative; }

/* ── Toolbar ── */
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

.tiptap-toolbar button:hover:not(:disabled) { background: var(--color-panel-hover); color: var(--color-fg); }
.tiptap-toolbar button.active { background: var(--color-accent-soft); color: var(--color-accent); }
.tiptap-toolbar button:disabled { opacity: 0.3; cursor: default; }

/* ── Input bars (link / image) ── */
.tiptap-input-bar {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 6px 8px;
	border: 1px solid var(--color-border);
	border-bottom: none;
	background: var(--color-bg-elevated);
}

.tiptap-input-bar__field {
	flex: 1;
	background: var(--color-bg);
	border: 1px solid var(--color-border);
	border-radius: 4px;
	padding: 3px 8px;
	font-size: 13px;
	color: var(--color-fg);
	outline: none;
}

.tiptap-input-bar__field:focus { border-color: var(--color-accent); }

.tiptap-input-bar__btn {
	padding: 3px 10px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	border: 1px solid var(--color-border);
	background: var(--color-panel-hover);
	color: var(--color-fg);
	white-space: nowrap;
}

.tiptap-input-bar__btn.primary {
	background: var(--color-accent);
	border-color: var(--color-accent);
	color: #fff;
}

/* ── Table context bar ── */
.tiptap-table-bar {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 4px 8px;
	border: 1px solid var(--color-border);
	border-bottom: none;
	background: var(--color-bg-elevated);
	flex-wrap: wrap;
}

.tiptap-table-bar button {
	padding: 2px 8px;
	border-radius: 4px;
	font-size: 11px;
	cursor: pointer;
	border: 1px solid var(--color-border);
	background: transparent;
	color: var(--color-fg-muted);
}

.tiptap-table-bar button:hover { background: var(--color-panel-hover); color: var(--color-fg); }
.tiptap-table-bar button.danger { color: #f87171; }
.tiptap-table-bar button.danger:hover { background: rgba(239, 68, 68, 0.1); }

/* ── Separator ── */
.tiptap-sep {
	display: inline-block;
	width: 1px;
	height: 18px;
	background: var(--color-border);
	margin: 0 3px;
	flex-shrink: 0;
}

/* ── Footer ── */
.tiptap-footer {
	padding: 3px 10px;
	font-size: 11px;
	color: var(--color-fg-subtle);
	border: 1px solid var(--color-border);
	border-top: none;
	border-radius: 0 0 6px 6px;
	background: var(--color-bg-elevated);
	text-align: right;
}

/* ── Editor content area ── */
.tiptap-editable .tiptap-content {
	border: 1px solid var(--color-border);
	padding: 10px 12px;
	min-height: 120px;
	outline: none;
	transition: border-color 0.15s;
	background: var(--color-bg-elevated);
}

.tiptap-editable .tiptap-content:focus { border-color: var(--color-accent); }

/* ── Content styles ── */
.tiptap-content {
	color: var(--color-fg);
	font-size: 14px;
	line-height: 1.6;
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
.tiptap-content sup { font-size: 0.75em; vertical-align: super; }
.tiptap-content sub { font-size: 0.75em; vertical-align: sub; }

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
	background: #1a1b26;
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
	color: #c0caf5;
}

/* Syntax highlighting (Tokyo Night dark) */
.tiptap-content pre .hljs-keyword,
.tiptap-content pre .hljs-selector-tag { color: #bb9af7; }
.tiptap-content pre .hljs-string,
.tiptap-content pre .hljs-attr { color: #9ece6a; }
.tiptap-content pre .hljs-number,
.tiptap-content pre .hljs-literal { color: #ff9e64; }
.tiptap-content pre .hljs-comment { color: #565f89; font-style: italic; }
.tiptap-content pre .hljs-title,
.tiptap-content pre .hljs-function { color: #7aa2f7; }
.tiptap-content pre .hljs-type,
.tiptap-content pre .hljs-class { color: #2ac3de; }
.tiptap-content pre .hljs-built_in { color: #e0af68; }
.tiptap-content pre .hljs-variable,
.tiptap-content pre .hljs-params { color: #c0caf5; }
.tiptap-content pre .hljs-punctuation,
.tiptap-content pre .hljs-operator { color: #89ddff; }
.tiptap-content pre .hljs-meta { color: #41a6b5; }
.tiptap-content pre .hljs-tag { color: #f7768e; }
.tiptap-content pre .hljs-regexp { color: #b4f9f8; }

.tiptap-content ul,
.tiptap-content ol {
	margin: 0.4em 0;
	padding-left: 1.4em;
}

.tiptap-content ul { list-style-type: disc; }
.tiptap-content ol { list-style-type: decimal; }
.tiptap-content li { margin: 0.2em 0; }

.tiptap-content ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.tiptap-content ul[data-type="taskList"] li { display: flex; align-items: baseline; gap: 6px; }
.tiptap-content ul[data-type="taskList"] li > label { flex-shrink: 0; }
.tiptap-content ul[data-type="taskList"] input[type="checkbox"] { accent-color: var(--color-accent); }

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

.tiptap-content tr:nth-child(even) td { background: var(--color-panel-hover); }

/* Selected table cell highlight */
.tiptap-content .selectedCell { background: color-mix(in oklab, var(--color-accent) 12%, transparent); }

.tiptap-content img {
	max-width: 100%;
	border-radius: 6px;
	margin: 0.5em 0;
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
