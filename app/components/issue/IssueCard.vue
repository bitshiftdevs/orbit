<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { UserRound } from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import { api, type Issue } from "~/lib/api";
import { notifyError } from "~/lib/notify";
import type { IssuePriority, IssueType, SessionUser } from "~/types/domain";
import { PRIORITY_META, TYPE_META } from "./meta";

type MemberLite = Pick<SessionUser, "id" | "name" | "handle" | "avatarUrl" | "accentColor">;

const props = defineProps<{
	issue: Issue;
	projectKey: string;
	members?: MemberLite[];
}>();
const emit = defineEmits<{
	open: [id: string];
	changed: [issue: Issue];
}>();

type PopoverKind = "type" | "priority" | "assignee";
const openPopover = ref<PopoverKind | null>(null);
const popoverStyle = ref<{ top: string; left: string; minWidth: string }>({
	top: "0px",
	left: "0px",
	minWidth: "0px",
});
const patching = ref(false);
const typeTriggerRef = ref<HTMLElement | null>(null);
const priorityTriggerRef = ref<HTMLElement | null>(null);
const assigneeTriggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);

const PRIORITIES = Object.keys(PRIORITY_META) as IssuePriority[];
const TYPES = Object.keys(TYPE_META) as IssueType[];
const membersList = computed<MemberLite[]>(() => props.members ?? []);

function togglePopover(kind: PopoverKind, e: MouseEvent) {
	e.stopPropagation();
	if (openPopover.value === kind) {
		openPopover.value = null;
		return;
	}
	const trigger =
		kind === "type"
			? typeTriggerRef.value
			: kind === "priority"
			? priorityTriggerRef.value
			: assigneeTriggerRef.value;
	if (!trigger) return;
	const rect = trigger.getBoundingClientRect();
	popoverStyle.value = {
		top: `${rect.bottom + 4}px`,
		left: `${rect.left}px`,
		minWidth: `${Math.max(rect.width, 160)}px`,
	};
	openPopover.value = kind;
}

function onDocPointerDown(e: PointerEvent) {
	if (popoverRef.value?.contains(e.target as Node)) return;
	if (
		typeTriggerRef.value?.contains(e.target as Node) ||
		priorityTriggerRef.value?.contains(e.target as Node) ||
		assigneeTriggerRef.value?.contains(e.target as Node)
	)
		return;
	openPopover.value = null;
}

if (typeof document !== "undefined") {
	document.addEventListener("pointerdown", onDocPointerDown);
	onUnmounted(() => document.removeEventListener("pointerdown", onDocPointerDown));
}

async function patchIssue(body: Record<string, unknown>) {
	if (patching.value) return;
	patching.value = true;
	try {
		const { issue: updated } = await api.patch<{ issue: Issue }>(
			`/issues/${props.issue.id}`,
			body,
		);
		emit("changed", { ...updated, key: props.issue.key });
	} catch (err) {
		notifyError(err);
	} finally {
		patching.value = false;
		openPopover.value = null;
	}
}

function selectType(t: IssueType) {
	if (t !== props.issue.type) patchIssue({ type: t });
	else openPopover.value = null;
}
function selectPriority(p: IssuePriority) {
	if (p !== props.issue.priority) patchIssue({ priority: p });
	else openPopover.value = null;
}
function selectAssignee(id: string | null) {
	if (id !== (props.issue.assigneeId ?? null)) patchIssue({ assigneeId: id });
	else openPopover.value = null;
}

function onCardClick(e: MouseEvent) {
	if (openPopover.value) return;
	const target = e.target as HTMLElement;
	if (target.closest("[data-inline-picker]")) return;
	emit("open", props.issue.id);
}
function onCardKey(e: KeyboardEvent) {
	if (e.key === "Enter" || e.key === " ") {
		e.preventDefault();
		emit("open", props.issue.id);
	}
}
</script>

<template>
	<div
		role="button"
		tabindex="0"
		class="group w-full text-left card card-hover p-3 space-y-2 cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/60"
		@click="onCardClick"
		@keydown="onCardKey"
	>
		<div class="flex items-center justify-between gap-2">
			<span class="mono text-[11px] text-[var(--color-fg-subtle)]">
				{{ issue.key }}
			</span>
			<button
				ref="priorityTriggerRef"
				type="button"
				data-inline-picker
				class="p-0.5 -m-0.5 rounded hover:bg-[var(--color-panel-hover)] transition-colors"
				:title="`Priority: ${PRIORITY_META[issue.priority].label}`"
				@click="(e) => togglePopover('priority', e)"
			>
				<component
					:is="PRIORITY_META[issue.priority].icon"
					class="h-3.5 w-3.5"
					:class="PRIORITY_META[issue.priority].text"
				/>
			</button>
		</div>
		<p class="text-sm text-[var(--color-fg)] leading-snug line-clamp-3">
			{{ issue.title }}
		</p>
		<div class="flex items-center justify-between pt-1">
			<div class="flex items-center gap-1.5">
				<button
					ref="typeTriggerRef"
					type="button"
					data-inline-picker
					class="p-0.5 -m-0.5 rounded hover:bg-[var(--color-panel-hover)] transition-colors"
					:title="`Type: ${TYPE_META[issue.type].label}`"
					@click="(e) => togglePopover('type', e)"
				>
					<component
						:is="TYPE_META[issue.type].icon"
						class="h-3.5 w-3.5"
						:class="TYPE_META[issue.type].text"
					/>
				</button>
				<span
					v-if="issue.storyPoints != null"
					class="mono text-[10px] text-[var(--color-fg-subtle)] px-1.5 py-[1px] rounded border border-[var(--color-border)]"
				>
					{{ issue.storyPoints }}
				</span>
			</div>
			<button
				ref="assigneeTriggerRef"
				type="button"
				data-inline-picker
				class="rounded-full hover:ring-2 hover:ring-[var(--color-border-strong)] transition-shadow"
				:title="issue.assignee ? `Assignee: ${issue.assignee.name}` : 'Unassigned'"
				@click="(e) => togglePopover('assignee', e)"
			>
				<Avatar
					v-if="issue.assignee"
					:name="issue.assignee.name"
					:src="issue.assignee.avatarUrl"
					:color="issue.assignee.accentColor"
					size="xs"
				/>
				<span
					v-else
					class="block h-5 w-5 rounded-full border border-dashed border-[var(--color-border-strong)] flex items-center justify-center"
				>
					<UserRound class="h-2.5 w-2.5 text-[var(--color-fg-subtle)]" />
				</span>
			</button>
		</div>

		<Teleport to="body">
			<div
				v-if="openPopover"
				ref="popoverRef"
				data-inline-picker
				class="fixed z-[200] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-xl py-1 max-h-64 overflow-y-auto"
				:style="popoverStyle"
			>
				<template v-if="openPopover === 'type'">
					<button
						v-for="t in TYPES"
						:key="t"
						type="button"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
						:class="t === issue.type ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click.stop="selectType(t)"
					>
						<component
							:is="TYPE_META[t].icon"
							class="h-3.5 w-3.5 shrink-0"
							:class="TYPE_META[t].text"
						/>
						{{ TYPE_META[t].label }}
					</button>
				</template>
				<template v-else-if="openPopover === 'priority'">
					<button
						v-for="p in PRIORITIES"
						:key="p"
						type="button"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
						:class="p === issue.priority ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click.stop="selectPriority(p)"
					>
						<component
							:is="PRIORITY_META[p].icon"
							class="h-3.5 w-3.5 shrink-0"
							:class="PRIORITY_META[p].text"
						/>
						{{ PRIORITY_META[p].label }}
					</button>
				</template>
				<template v-else-if="openPopover === 'assignee'">
					<button
						type="button"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
						:class="!issue.assigneeId ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click.stop="selectAssignee(null)"
					>
						<UserRound class="h-3.5 w-3.5 text-[var(--color-fg-subtle)] shrink-0" />
						Unassigned
					</button>
					<button
						v-for="m in membersList"
						:key="m.id"
						type="button"
						class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[var(--color-panel-hover)] transition-colors"
						:class="m.id === issue.assigneeId ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)]'"
						@click.stop="selectAssignee(m.id)"
					>
						<Avatar :name="m.name" :src="m.avatarUrl" :color="m.accentColor" size="xs" />
						<span class="truncate">{{ m.name }}</span>
					</button>
					<div
						v-if="!membersList.length"
						class="px-3 py-2 text-xs text-[var(--color-fg-subtle)]"
					>
						No members
					</div>
				</template>
			</div>
		</Teleport>
	</div>
</template>
