import { Hono } from "hono";
import { getPrisma } from "../lib/prisma";
import type { Env } from "../types";

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
projects.get("/", async (c) => {
  const prisma = getPrisma(c.env);
  const isDashboard = c.req.query("dashboard") === "true";
  try {
    const allProjects = await prisma.project.findMany({
      ...(isDashboard && {
        include: {
          bugs: { select: { id: true, description: true, status: true } },
          todos: { select: { id: true, description: true, status: true } },
        },
      }),
      orderBy: { createdAt: "desc" },
    });

    return c.json(allProjects.map(parseProjectFields));
  } catch (error: any) {
    console.error("error fetching projects", error);
    return c.json({ error: error.message || "Failed to fetch projects" }, 500);
  }
});

// Get a single project with all related data
projects.get("/:id", async (c) => {
  const prisma = getPrisma(c.env);
  const { id } = c.req.param();
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        bugs: true,
        todos: true,
        secrets: true,
        envVars: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
          },
        },
      },
    });

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(parseProjectFields(project));
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to fetch project" }, 500);
  }
});

// Create a new project
projects.post("/", async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const { name, description, status, stack, images, clientId } =
      await c.req.json();

    // Validate required fields
    if (!name || !description || !status) {
      return c.json(
        { error: "Name, description, and status are required" },
        400,
      );
    }

    // Prepare data with optional client relation
    const data: any = {
      name,
      description,
      status,
      stack: JSON.stringify(stack || []),
      images: JSON.stringify(images || []),
    };

    // Add client if provided
    if (clientId) {
      // Verify client exists
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        return c.json({ error: "Client not found" }, 404);
      }
      data.clientId = clientId;
    }

    const project = await prisma.project.create({ data });

    return c.json(parseProjectFields(project), 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to create project" }, 500);
  }
});

// Update a project
projects.put("/:id", async (c) => {
  const prisma = getPrisma(c.env);
  const { id } = c.req.param();
  try {
    const { name, description, status, stack, images, clientId } =
      await c.req.json();

    // Validate required fields
    if (!name || !description || !status) {
      return c.json(
        { error: "Name, description, and status are required" },
        400,
      );
    }

    // Prepare data with optional client relation
    const data: any = {
      name,
      description,
      status,
      stack: JSON.stringify(stack || []),
      images: JSON.stringify(images || []),
    };

    // Update client if provided
    if (clientId !== undefined) {
      if (clientId) {
        // Verify client exists
        const client = await prisma.client.findUnique({
          where: { id: clientId },
        });
        if (!client) {
          return c.json({ error: "Client not found" }, 404);
        }
        data.clientId = clientId;
      } else {
        // Remove client association
        data.clientId = null;
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data,
    });

    return c.json(parseProjectFields(project));
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ error: "Project not found" }, 404);
    }
    return c.json({ error: error.message || "Failed to update project" }, 500);
  }
});

// Delete a project
projects.delete("/:id", async (c) => {
  const prisma = getPrisma(c.env);
  const { id } = c.req.param();
  try {
    await prisma.project.delete({
      where: { id },
    });

    return c.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ error: "Project not found" }, 404);
    }
    return c.json({ error: error.message || "Failed to delete project" }, 500);
  }
});

// Assign a project to a client
projects.post("/:id/assign-client", async (c) => {
  const prisma = getPrisma(c.env);
  const { id } = c.req.param();
  try {
    const { clientId } = await c.req.json();

    // Validate required fields
    if (!clientId) {
      return c.json({ error: "Client ID is required" }, 400);
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    const project = await prisma.project.update({
      where: { id },
      data: { clientId },
    });

    return c.json(parseProjectFields(project));
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ error: "Project not found" }, 404);
    }
    return c.json(
      { error: error.message || "Failed to assign client to project" },
      500,
    );
  }
});

// Remove client from a project
projects.post("/:id/remove-client", async (c) => {
  const prisma = getPrisma(c.env);
  const { id } = c.req.param();
  try {
    const project = await prisma.project.update({
      where: { id },
      data: { clientId: null },
    });

    return c.json(parseProjectFields(project));
  } catch (error: any) {
    if (error.code === "P2025") {
      return c.json({ error: "Project not found" }, 404);
    }
    return c.json(
      { error: error.message || "Failed to remove client from project" },
      500,
    );
  }
});

// Add a bug to a project
projects.post("/:id/bugs", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { description, status } = await c.req.json();

    if (!description) {
      return c.json({ error: "Description is required" }, 400);
    }

    const bug = await prisma.bug.create({
      data: {
        projectId,
        description,
        status: status || "open",
      },
    });

    return c.json(bug, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to add bug" }, 500);
  }
});

// Add a client bug to a project
projects.post("/:id/bugs/client", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { description, status, apiKey } = await c.req.json();

    if (!description) {
      return c.json({ error: "Description is required" }, 400);
    }

    if (!apiKey) {
      return c.json({ error: "API key is required" }, 401);
    }

    // Verify client by API key
    const client = await prisma.client.findUnique({
      where: { apiKey },
    });

    if (!client) {
      return c.json({ error: "Invalid API key" }, 401);
    }

    const bug = await prisma.bug.create({
      data: {
        projectId,
        description,
        status: status || "open",
        clientId: client.id,
      },
    });

    return c.json(bug, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to add bug" }, 500);
  }
});

// Add a todo to a project
projects.post("/:id/todos", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { description, status } = await c.req.json();

    if (!description) {
      return c.json({ error: "Description is required" }, 400);
    }

    const todo = await prisma.todo.create({
      data: {
        projectId,
        description,
        status: status || "todo",
      },
    });

    return c.json(todo, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to add todo" }, 500);
  }
});

// Add a client todo to a project
projects.post("/:id/todos/client", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { description, status, apiKey } = await c.req.json();

    if (!description) {
      return c.json({ error: "Description is required" }, 400);
    }

    if (!apiKey) {
      return c.json({ error: "API key is required" }, 401);
    }

    // Verify client by API key
    const client = await prisma.client.findUnique({
      where: { apiKey },
    });

    if (!client) {
      return c.json({ error: "Invalid API key" }, 401);
    }

    const todo = await prisma.todo.create({
      data: {
        projectId,
        description,
        status: status || "todo",
        clientId: client.id,
      },
    });

    return c.json(todo, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to add todo" }, 500);
  }
});

// Add a secret to a project
projects.post("/:id/secrets", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { key, value } = await c.req.json();

    if (!key || !value) {
      return c.json({ error: "Key and value are required" }, 400);
    }

    // In a real app, you'd encrypt the value here
    const secret = await prisma.secret.create({
      data: {
        projectId,
        key,
        value,
      },
    });

    return c.json(secret, 201);
  } catch (error: any) {
    return c.json({ error: error.message || "Failed to add secret" }, 500);
  }
});

// Add an environment variable to a project
projects.post("/:id/envvars", async (c) => {
  const prisma = getPrisma(c.env);
  const { id: projectId } = c.req.param();
  try {
    const { key, value } = await c.req.json();

    if (!key || !value) {
      return c.json({ error: "Key and value are required" }, 400);
    }

    // In a real app, you might encrypt sensitive values
    const envVar = await prisma.envVar.create({
      data: {
        projectId,
        key,
        value,
      },
    });

    return c.json(envVar, 201);
  } catch (error: any) {
    return c.json(
      { error: error.message || "Failed to add environment variable" },
      500,
    );
  }
});

// Get project statistics
projects.get("/stats", async (c) => {
  const prisma = getPrisma(c.env);
  try {
    const totalProjects = await prisma.project.count();
    const activeProjects = await prisma.project.count({
      where: { status: "active" },
    });
    const completedProjects = await prisma.project.count({
      where: { status: "completed" },
    });
    const totalBugs = await prisma.bug.count();
    const openBugs = await prisma.bug.count({
      where: { status: "open" },
    });
    const totalTodos = await prisma.todo.count();
    const pendingTodos = await prisma.todo.count({
      where: { status: "todo" },
    });

    return c.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalBugs,
      openBugs,
      totalTodos,
      pendingTodos,
    });
  } catch (error: any) {
    return c.json(
      { error: error.message || "Failed to fetch statistics" },
      500,
    );
  }
});

export default projects;
