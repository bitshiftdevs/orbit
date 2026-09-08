import { createRouter, createWebHistory } from "vue-router";
import { useSession } from "@/stores/session";

const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes: [
		{
			path: "/login",
			name: "login",
			component: () => import("@/views/LoginView.vue"),
			meta: { public: true, layout: "blank" },
		},
		{
			path: "/accept-invite/:token",
			name: "accept-invite",
			component: () => import("@/views/AcceptInviteView.vue"),
			meta: { public: true, layout: "blank" },
		},
		{
			path: "/",
			component: () => import("@/layouts/AppShell.vue"),
			children: [
				{
					path: "",
					name: "dashboard",
					component: () => import("@/views/DashboardView.vue"),
				},
				{
					path: "projects",
					name: "projects",
					component: () => import("@/views/ProjectsView.vue"),
				},
				{
					path: "projects/:key",
					component: () => import("@/views/ProjectShell.vue"),
					children: [
						{
							path: "",
							name: "project-board",
							component: () => import("@/views/ProjectBoardView.vue"),
						},
						{
							path: "backlog",
							name: "project-backlog",
							component: () => import("@/views/ProjectBacklogView.vue"),
						},
						{
							path: "sprints",
							name: "project-sprints",
							component: () => import("@/views/ProjectSprintsView.vue"),
						},
						{
							path: "secrets",
							name: "project-secrets",
							component: () => import("@/views/ProjectSecretsView.vue"),
						},
						{
							path: "files",
							name: "project-files",
							component: () => import("@/views/ProjectFilesView.vue"),
						},
						{
							path: "webhooks",
							name: "project-webhooks",
							component: () => import("@/views/ProjectWebhooksView.vue"),
						},
						{
							path: "audit",
							name: "project-audit",
							component: () => import("@/views/ProjectAuditView.vue"),
						},
					],
				},
				{
					path: "team",
					name: "team",
					component: () => import("@/views/TeamView.vue"),
				},
				{
					path: "settings",
					name: "settings",
					component: () => import("@/views/SettingsView.vue"),
				},
				{
					path: "i/:issueId",
					name: "issue-jump",
					component: () => import("@/views/IssueJumpView.vue"),
				},
			],
		},
	],
});

router.beforeEach(async (to) => {
	const session = useSession();
	if (session.loading) {
		await session.refresh();
	}
	if (!to.meta.public && !session.user) {
		return { name: "login", query: { r: to.fullPath } };
	}
	if (to.name === "login" && session.user) {
		return { name: "dashboard" };
	}
});

router.afterEach((to) => {
	const name = String(to.name ?? "");
	document.title = name
		? `${name.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())} · Orbit`
		: "Orbit · BitShift";
});

export default router;
