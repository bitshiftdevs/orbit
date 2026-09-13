import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  modules: ["@pinia/nuxt", "@vueuse/nuxt"],
  devtools: { enabled: true },
  ssr: false,

  runtimeConfig: {
    public: {
      apiBase: "/api",
    },
  },

  app: {
    head: {
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#09090b" },
        {
          name: "description",
          content: "Internal mission control for BitShift projects.",
        },
      ],
      link: [
        { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "preconnect", href: "https://rsms.me" },
        { rel: "stylesheet", href: "https://rsms.me/inter/inter.css" },
      ],
      title: "Orbit — BitShift",
    },
  },

  css: ["~/assets/main.css", "vue-sonner/style.css"],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        "@vue/devtools-core",
        "@vue/devtools-kit",
        "vue-sonner",
        "clsx",
        "lucide-vue-next",
        "tailwind-merge",
        "@tiptap/core",
        "@tiptap/extension-character-count",
        "@tiptap/extension-code-block-lowlight",
        "@tiptap/extension-image",
        "@tiptap/extension-link",
        "@tiptap/extension-mention",
        "@tiptap/extension-placeholder",
        "@tiptap/extension-subscript",
        "@tiptap/extension-superscript",
        "@tiptap/extension-table-cell",
        "@tiptap/extension-table-header",
        "@tiptap/extension-table-row",
        "@tiptap/extension-table",
        "@tiptap/extension-task-item",
        "@tiptap/extension-task-list",
        "@tiptap/extension-typography",
        "@tiptap/starter-kit",
        "@tiptap/suggestion",
        "@tiptap/vue-3",
        "lowlight",
        "tiptap-markdown",
      ],
    },
  },
  nitro: {
    preset: "vercel",
    // NOTE: do not mark @node-rs/argon2 as `external` here. Nitro's
    // node-externals plugin already externalizes it (Rollup can't bundle the
    // native .node binary) AND traces its literal require() calls into the
    // platform-binary packages (@node-rs/argon2-linux-x64-{gnu,musl}) so they
    // are copied into the Vercel function bundle. Forcing it external via
    // rollupConfig bypasses that tracing → ERR_MODULE_NOT_FOUND at runtime.
  },

  compatibilityDate: "2025-11-30",
});
