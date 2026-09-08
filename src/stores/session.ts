import { defineStore } from "pinia";
import { ref } from "vue";
import { api, type SessionUser } from "@/lib/api";

export const useSession = defineStore("session", () => {
	const user = ref<SessionUser | null>(null);
	const loading = ref(true);

	async function refresh() {
		try {
			const { user: u } = await api.get<{ user: SessionUser | null }>(
				"/auth/me",
			);
			user.value = u;
		} finally {
			loading.value = false;
		}
	}

	async function login(email: string, password: string) {
		const { user: u } = await api.post<{ user: SessionUser }>("/auth/login", {
			email,
			password,
		});
		user.value = u;
	}

	async function logout() {
		await api.post("/auth/logout");
		user.value = null;
	}

	async function acceptInvite(payload: {
		token: string;
		name: string;
		handle: string;
		password: string;
	}) {
		const { user: u } = await api.post<{ user: SessionUser }>(
			"/auth/accept-invite",
			payload,
		);
		user.value = u;
	}

	return { user, loading, refresh, login, logout, acceptInvite };
});
