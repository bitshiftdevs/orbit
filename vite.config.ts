import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [vue(), vueDevTools(), tailwindcss()],
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:8888",
				changeOrigin: true,
			},
		},
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
		},
	},
});
