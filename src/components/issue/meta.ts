import {
	Bug,
	CheckCircle2,
	ChevronsUp,
	ChevronUp,
	Circle,
	CircleDashed,
	CircleDot,
	CircleDotDashed,
	Equal,
	Feather,
	Flame,
	ListTodo,
	Milestone,
	Rocket,
	Wrench,
	XCircle,
	type LucideIcon,
} from "lucide-vue-next";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/api";

export const STATUS_META: Record<
	IssueStatus,
	{ label: string; icon: LucideIcon; tone: string; text: string; ring: string }
> = {
	backlog: {
		label: "Backlog",
		icon: CircleDashed,
		tone: "bg-zinc-500/10",
		text: "text-zinc-400",
		ring: "ring-zinc-500/30",
	},
	todo: {
		label: "Todo",
		icon: Circle,
		tone: "bg-slate-500/10",
		text: "text-slate-300",
		ring: "ring-slate-500/30",
	},
	in_progress: {
		label: "In progress",
		icon: CircleDotDashed,
		tone: "bg-blue-500/10",
		text: "text-blue-300",
		ring: "ring-blue-500/30",
	},
	in_review: {
		label: "In review",
		icon: CircleDot,
		tone: "bg-violet-500/10",
		text: "text-violet-300",
		ring: "ring-violet-500/30",
	},
	done: {
		label: "Done",
		icon: CheckCircle2,
		tone: "bg-emerald-500/10",
		text: "text-emerald-300",
		ring: "ring-emerald-500/30",
	},
	cancelled: {
		label: "Cancelled",
		icon: XCircle,
		tone: "bg-red-500/10",
		text: "text-red-300",
		ring: "ring-red-500/30",
	},
};

export const BOARD_STATUSES: IssueStatus[] = [
	"backlog",
	"todo",
	"in_progress",
	"in_review",
	"done",
];

export const PRIORITY_META: Record<
	IssuePriority,
	{ label: string; icon: LucideIcon; text: string }
> = {
	trivial: { label: "Trivial", icon: Equal, text: "text-zinc-500" },
	low: { label: "Low", icon: Equal, text: "text-slate-400" },
	medium: { label: "Medium", icon: ChevronUp, text: "text-blue-400" },
	high: { label: "High", icon: ChevronsUp, text: "text-amber-400" },
	urgent: { label: "Urgent", icon: Flame, text: "text-red-400" },
};

export const TYPE_META: Record<
	IssueType,
	{ label: string; icon: LucideIcon; text: string }
> = {
	task: { label: "Task", icon: ListTodo, text: "text-blue-300" },
	bug: { label: "Bug", icon: Bug, text: "text-red-300" },
	story: { label: "Story", icon: Feather, text: "text-emerald-300" },
	epic: { label: "Epic", icon: Milestone, text: "text-violet-300" },
	chore: { label: "Chore", icon: Wrench, text: "text-slate-300" },
};

export const PROJECT_ICONS: Record<string, LucideIcon> = {
	rocket: Rocket,
	bug: Bug,
	feather: Feather,
	milestone: Milestone,
	wrench: Wrench,
	flame: Flame,
};
