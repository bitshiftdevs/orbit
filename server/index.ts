import { Hono } from 'hono';
import { cors } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import projects from './routes/projects';
import clients from './routes/clients';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', cors);
app.use('*', errorHandler);

// Health check
app.get('/api/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Project management API
app.route('/api/projects', projects);

// Client management API
app.route('/api/clients', clients);

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Handle API routes
		if (url.pathname.startsWith('/api/')) {
			return app.fetch(request, env, ctx);
		}

		// Serve static assets for SPA
		try {
			const assetPath = url.pathname === '/' ? '/index.html' : url.pathname;
			const asset = await env.ASSETS.fetch(new Request(new URL(assetPath, request.url)));

			if (asset.status === 200) {
				return asset;
			}
		} catch (error) {
			// Fall through to index.html
		}

		// Fallback to index.html for SPA routing
		try {
			return await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
		} catch (error) {
			return new Response('Not found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
