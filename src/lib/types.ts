export type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  stack: string[];
  images: string[];
  createdAt?: string;
  bugs: Bug[];
  todos: Todo[];
  secrets: Secret[];
  envVars: EnvVar[];
  client?: Client;
};

export type Bug = {
  id: string;
  description: string;
  status: string;
  projectId: string;
  project?: Project;
};

export type Todo = {
  id: string;
  description: string;
  status: string;
  projectId: string;
  project?: Project;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  apiKey: string;
};
export type Secret = {
  value: string;
  key: string;
};
export type EnvVar = {
  value: string;
  key: string;
};
