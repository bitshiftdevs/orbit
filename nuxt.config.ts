export default defineNuxtConfig({
  modules: ["@nuxt/devtools", "@vueuse/nuxt"],
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
  postcss: {
    plugins: [],
  },
  compatibilityDate: "2025-11-30",
  treeShake: {
    aliases: {
      vue: "vue/dist/vue.mjs",
      "vue-router": "vue-router/dist/vue-router.mjs",
      pinia: "pinia/dist/pinia.mjs",
    },
  },
  nitro: {
    preset: "vercel",
    externals: [{ handler: "unhandled", entries: ["@node-rs/argon2"] }],
    rollupConfig: {
      external: ["@node-rs/argon2"],
    },
  },
  appConfig: {
    apiBase: "/api",
  },
});
