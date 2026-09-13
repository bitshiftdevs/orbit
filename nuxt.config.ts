import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  modules: ["@vueuse/nuxt"],
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
  },
  nitro: {
    preset: "vercel",
    externals: { external: ["@node-rs/argon2"] },
    rollupConfig: {
      external: ["@node-rs/argon2"],
    },
  },

  compatibilityDate: "2025-11-30",
});
