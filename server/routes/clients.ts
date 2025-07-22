import { Hono } from 'hono';
import { getPrisma } from '../lib/prisma';
import type { Env } from '../types';

const clients = new Hono<{ Bindings: Env }>();

// Get all clients
clients.get('/', async (c) => {
    const prisma = getPrisma(c.env);
    try {
        const allClients = await prisma.client.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                company: true,
                phone: true,
                apiKey: true,
            }
        });
        return c.json(allClients);
    } catch (error: any) {
        console.error("error fetching clients", error)
        return c.json({ error: error.message || 'Failed to fetch clients' }, 500);
    }
});

// Get a single client
clients.get('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    try {
        const client = await prisma.client.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                company: true,
                phone: true,
                apiKey: true,
                projects: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
                bugs: {
                    select: {
                        id: true,
                        description: true,
                        status: true,
                        projectId: true,
                        project: {
                            select: {
                                name: true,
                            }
                        }
                    }
                },
                todos: {
                    select: {
                        id: true,
                        description: true,
                        status: true,
                        projectId: true,
                        project: {
                            select: {
                                name: true,
                            }
                        }
                    }
                }
            }
        });

        if (!client) {
            return c.json({ error: 'Client not found' }, 404);
        }

        return c.json(client);
    } catch (error: any) {
        return c.json({ error: error.message || 'Failed to fetch client' }, 500);
    }
});

// Create a new client
clients.post('/', async (c) => {
    const prisma = getPrisma(c.env);
    try {
        const { name, email, company, phone } = await c.req.json();

        // Validate required fields
        if (!name || !email) {
            return c.json({ error: 'Name and email are required' }, 400);
        }

        // Check if email already exists
        const existingClient = await prisma.client.findUnique({
            where: { email }
        });

        if (existingClient) {
            return c.json({ error: 'A client with this email already exists' }, 400);
        }

        // Generate a unique API key
        const apiKey = `client_${Math.random().toString(36).substring(2, 15)}`;

        const client = await prisma.client.create({
            data: {
                name,
                email,
                company,
                phone,
                apiKey,
            }
        });

        return c.json(client, 201);
    } catch (error: any) {
        return c.json({ error: error.message || 'Failed to create client' }, 500);
    }
});

// Update a client
clients.put('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    try {
        const { name, email, company, phone } = await c.req.json();

        // Validate required fields
        if (!name || !email) {
            return c.json({ error: 'Name and email are required' }, 400);
        }

        // Check if email already exists for another client
        const existingClient = await prisma.client.findUnique({
            where: { email }
        });

        if (existingClient && existingClient.id !== id) {
            return c.json({ error: 'A client with this email already exists' }, 400);
        }

        const client = await prisma.client.update({
            where: { id },
            data: {
                name,
                email,
                company,
                phone,
            }
        });

        return c.json(client);
    } catch (error: any) {
        if (error.code === 'P2025') {
            return c.json({ error: 'Client not found' }, 404);
        }
        return c.json({ error: error.message || 'Failed to update client' }, 500);
    }
});

// Delete a client
clients.delete('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    try {
        await prisma.client.delete({
            where: { id }
        });

        return c.json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return c.json({ error: 'Client not found' }, 404);
        }
        return c.json({ error: error.message || 'Failed to delete client' }, 500);
    }
});

// Generate a new API key for a client
clients.post('/:id/regenerate-key', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    try {
        // Generate a unique API key
        const apiKey = `client_${Math.random().toString(36).substring(2, 15)}`;

        const client = await prisma.client.update({
            where: { id },
            data: { apiKey }
        });

        return c.json({ apiKey: client.apiKey });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return c.json({ error: 'Client not found' }, 404);
        }
        return c.json({ error: error.message || 'Failed to regenerate API key' }, 500);
    }
});

export default clients; 