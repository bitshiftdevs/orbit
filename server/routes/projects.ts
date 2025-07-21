import { Hono } from 'hono';
import { getPrisma } from '../lib/prisma';
import type { Env } from '../types';

const projects = new Hono<{ Bindings: Env }>();

// Helper to parse JSON fields
function parseProjectFields(project: any) {
    return {
        ...project,
        stack: project.stack ? JSON.parse(project.stack) : [],
        images: project.images ? JSON.parse(project.images) : [],
    };
}

// Get all projects
projects.get('/', async (c) => {
    const prisma = getPrisma(c.env);
    const all = await prisma.project.findMany({
        include: { bugs: true, todos: true, secrets: true, envVars: true },
        orderBy: { createdAt: 'desc' },
    });
    return c.json(all.map(parseProjectFields));
});

// Get single project
projects.get('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    const project = await prisma.project.findUnique({
        where: { id },
        include: { bugs: true, todos: true, secrets: true, envVars: true },
    });
    if (!project) return c.notFound();
    return c.json(parseProjectFields(project));
});

// Create project
projects.post('/', async (c) => {
    const prisma = getPrisma(c.env);
    const body = await c.req.json();
    const project = await prisma.project.create({
        data: {
            name: body.name,
            description: body.description,
            status: body.status,
            stack: JSON.stringify(body.stack || []),
            images: JSON.stringify(body.images || []),
        },
    });
    return c.json(parseProjectFields(project));
});

// Update project
projects.put('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    const body = await c.req.json();
    const project = await prisma.project.update({
        where: { id },
        data: {
            name: body.name,
            description: body.description,
            status: body.status,
            stack: JSON.stringify(body.stack || []),
            images: JSON.stringify(body.images || []),
        },
    });
    return c.json(parseProjectFields(project));
});

// Delete project
projects.delete('/:id', async (c) => {
    const prisma = getPrisma(c.env);
    const { id } = c.req.param();
    await prisma.project.delete({ where: { id } });
    return c.json({ ok: true });
});

// --- Bugs ---
projects.post('/:id/bugs', async (c) => {
    const prisma = getPrisma(c.env);
    const { id: projectId } = c.req.param();
    const { description, status } = await c.req.json();
    const bug = await prisma.bug.create({
        data: { projectId, description, status },
    });
    return c.json(bug);
});

// --- Todos ---
projects.post('/:id/todos', async (c) => {
    const prisma = getPrisma(c.env);
    const { id: projectId } = c.req.param();
    const { description, status } = await c.req.json();
    const todo = await prisma.todo.create({
        data: { projectId, description, status },
    });
    return c.json(todo);
});

// --- Secrets ---
projects.post('/:id/secrets', async (c) => {
    const prisma = getPrisma(c.env);
    const { id: projectId } = c.req.param();
    const { key, value } = await c.req.json();
    // TODO: Encrypt value before storing
    const secret = await prisma.secret.create({
        data: { projectId, key, value },
    });
    return c.json(secret);
});

// --- Env Vars ---
projects.post('/:id/envvars', async (c) => {
    const prisma = getPrisma(c.env);
    const { id: projectId } = c.req.param();
    const { key, value } = await c.req.json();
    // TODO: Encrypt value before storing
    const envVar = await prisma.envVar.create({
        data: { projectId, key, value },
    });
    return c.json(envVar);
});

export default projects; 