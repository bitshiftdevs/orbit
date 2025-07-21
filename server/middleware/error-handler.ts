import type { Context, Next } from 'hono';

export async function errorHandler(c: Context, next: Next) {
    try {
        await next();
    } catch (error) {
        console.error('Unhandled error:', error);

        if (error instanceof Error) {
            if (error.message === 'Unauthorized') {
                return c.json({ error: 'Unauthorized' }, 401);
            }
            if (error.message === 'Forbidden') {
                return c.json({ error: 'Forbidden' }, 403);
            }
            if (error.message === 'Not Found') {
                return c.json({ error: 'Not found' }, 404);
            }
        }

        return c.json({ error: 'Internal server error' }, 500);
    }
} 