import { fileURLToPath, URL } from "node:url";

import { defineConfig, loadEnv, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";
import devServer from "@hono/vite-dev-server";

const resetBase: Plugin = {
  name: "reset-base",
  enforce: "post",
  config: () => ({ base: "/" }),
};

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [
      vue(),
      vueDevTools(),
      tailwindcss(),
      devServer({
        entry: "server/index.ts",
        base: "/api",
      }),
      resetBase,
    ],
    server: {
      port: 5173,
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["vue", "vue-router", "pinia"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@server": fileURLToPath(new URL("./server", import.meta.url)),
      },
    },
  };
});
