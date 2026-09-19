<script setup lang="ts">
import { ref } from "vue";
import OrbitLogo from "~/components/OrbitLogo.vue";
import {
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  FolderKanban,
  LayoutDashboard,
} from "lucide-vue-next";
import Avatar from "~/components/ui/Avatar.vue";
import CommandPalette from "~/components/CommandPalette.vue";
import ConfirmDialog from "~/components/ui/ConfirmDialog.vue";
import KeyboardShortcutsModal from "~/components/KeyboardShortcutsModal.vue";
import NotificationsBell from "~/components/NotificationsBell.vue";
import { useShortcuts } from "~/composables/useShortcuts";
import { useProjects } from "~/stores/projects";
import { useSession } from "~/stores/session";
import { useNotifications } from "~/stores/notifications";
import { useTheme } from "~/composables/useTheme";

const session = useSession();
const projects = useProjects();
const notifications = useNotifications();
const { isLight, toggle: toggleTheme } = useTheme();

const paletteOpen = ref(false);
const shortcutsOpen = ref(false);

if (import.meta.client) {
  projects.ensureLoaded();
}

useShortcuts({
  "mod+k": () => (paletteOpen.value = true),
  "/": () => (paletteOpen.value = true),
  "g d": () => navigateTo({ name: "dashboard" }),
  "g p": () => navigateTo({ name: "projects" }),
  "g t": () => navigateTo({ name: "team" }),
  "g s": () => navigateTo({ name: "settings" }),
});

async function logout() {
  await session.logout();
  navigateTo({ name: "login" });
}
</script>

<template>
  <div class="h-full grid grid-cols-[240px_1fr]">
    <aside
      class="h-full flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]"
    >
      <div
        class="px-4 py-4 flex items-center gap-2 border-b border-[var(--color-border)]"
      >
        <div
          class="h-7 w-7 rounded-md grid place-items-center bg-[var(--color-accent)] shadow-[0_0_20px_var(--color-accent-glow)]"
        >
          <OrbitLogo class="h-5 w-5" />
        </div>
        <div>
          <div class="text-sm font-semibold tracking-tight">Orbit</div>
          <div
            class="text-[10px] text-[var(--color-fg-subtle)] uppercase tracking-widest"
          >
            BitShift
          </div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto py-2 text-sm">
        <div class="px-2 space-y-0.5">
          <NuxtLink
            :to="{ name: 'dashboard' }"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
            active-class="bg-[var(--color-panel)] text-[var(--color-fg)]"
          >
            <LayoutDashboard class="h-4 w-4" />
            Dashboard
          </NuxtLink>
          <NuxtLink
            :to="{ name: 'projects' }"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
            active-class="bg-[var(--color-panel)] text-[var(--color-fg)]"
          >
            <FolderKanban class="h-4 w-4" />
            Projects
          </NuxtLink>
          <NuxtLink
            :to="{ name: 'team' }"
            class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)]"
            active-class="bg-[var(--color-panel)] text-[var(--color-fg)]"
          >
            <Users class="h-4 w-4" />
            Team
          </NuxtLink>
        </div>

        <div class="mt-6 px-4">
          <h4
            class="text-[10px] uppercase tracking-widest text-[var(--color-fg-subtle)] font-semibold mb-2"
          >
            Projects
          </h4>
          <ul class="space-y-0.5">
            <li v-for="p in projects.items" :key="p.id">
              <NuxtLink
                :to="{ name: 'project-board', params: { key: p.key } }"
                class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-fg)] text-[13px]"
                active-class="bg-[var(--color-panel)] text-[var(--color-fg)]"
              >
                <span
                  class="h-2 w-2 rounded-full shrink-0"
                  :style="{ background: p.color }"
                />
                <span class="mono text-[10px] text-[var(--color-fg-subtle)]">{{
                  p.key
                }}</span>
                <span class="truncate">{{ p.name }}</span>
              </NuxtLink>
            </li>
            <li v-if="!projects.loading && !projects.items.length">
              <NuxtLink
                :to="{ name: 'projects' }"
                class="block text-xs text-[var(--color-fg-subtle)] px-2 py-2 hover:text-[var(--color-fg)]"
              >
                + create your first project
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <button
        type="button"
        class="mx-3 mb-3 flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
        @click="paletteOpen = true"
      >
        <Search class="h-3.5 w-3.5" />
        <span class="flex-1 text-left">Search…</span>
        <kbd
          class="mono text-[10px] px-1 py-0.5 rounded bg-[var(--color-panel)] border border-[var(--color-border)]"
        >
          ⌘K
        </kbd>
      </button>

      <div
        class="border-t border-[var(--color-border)] px-3 py-3 flex items-center gap-2"
      >
        <Avatar
          v-if="session.user"
          :name="session.user.name"
          :src="session.user.avatarUrl"
          :color="session.user.accentColor"
          size="md"
        />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate">
            {{ session.user?.name }}
          </div>
          <div class="text-[10px] text-[var(--color-fg-subtle)] mono truncate">
            @{{ session.user?.handle }}
          </div>
        </div>
        <NotificationsBell />
        <button
          class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]"
          :title="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
          @click="toggleTheme"
        >
          <component :is="isLight ? Moon : Sun" class="h-4 w-4" />
        </button>
        <NuxtLink
          :to="{ name: 'settings' }"
          class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-panel)]"
          title="Settings"
        >
          <Settings class="h-4 w-4" />
        </NuxtLink>
        <button
          class="p-1.5 rounded text-[var(--color-fg-subtle)] hover:text-red-400 hover:bg-red-500/10"
          title="Log out"
          @click="logout"
        >
          <LogOut class="h-4 w-4" />
        </button>
      </div>
    </aside>

    <main class="h-full overflow-hidden flex flex-col">
      <slot />
    </main>

    <CommandPalette v-model:open="paletteOpen" />
    <ConfirmDialog />
    <KeyboardShortcutsModal v-model:open="shortcutsOpen" />
  </div>
</template>
