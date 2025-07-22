import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from "@cloudflare/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		vue(),
		vueDevTools(),
		cloudflare(),
		tailwindcss()
	],
	optimizeDeps: {
		esbuildOptions: {
			sourcemap: true,
			treeShaking: true,
		},
	},
	build: {
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
			'@': fileURLToPath(new URL('./src', import.meta.url))
		},
	},
})
