#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fetch from 'node-fetch';

// Type definitions for n8n API responses
interface N8nUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  isPending: boolean;
  role?: string;
  createdAt: string;
  updatedAt: string;
}

interface N8nUserList {
  data: N8nUser[];
  nextCursor?: string;
}

interface N8nWorkflow {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface N8nWorkflowList {
  data: N8nWorkflow[];
  nextCursor?: string;
}

interface N8nProject {
  id: string;
  name: string;
  type?: string;
}

interface N8nProjectList {
  data: N8nProject[];
  nextCursor?: string;
}

interface N8nVariable {
  id: string;
  key: string;
  value: string;
  type?: string;
}

interface N8nVariableList {
  data: N8nVariable[];
  nextCursor?: string;
}

interface N8nExecution {
  id: number;
  data?: any;
  finished: boolean;
  mode: string;
  retryOf?: number;
  retrySuccessId?: number;
  startedAt: string;
  stoppedAt?: string;
  workflowId: number;
  waitTill?: string;
}

interface N8nExecutionList {
  data: N8nExecution[];
  nextCursor?: string;
}

interface N8nTag {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

interface N8nTagList {
  data: N8nTag[];
  nextCursor?: string;
}

interface N8nAuditResult {
  'Credentials Risk Report'?: any;
  'Database Risk Report'?: any;
  'Filesystem Risk Report'?: any;
  'Nodes Risk Report'?: any;
  'Instance Risk Report'?: any;
}

class N8nClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async makeRequest<T>(endpoint: string, options: any = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const headers = {
      'X-N8N-API-KEY': this.apiKey,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText);
          // Check for license-related errors
          if (errorJson.message && errorJson.message.includes('license')) {
            errorMessage = `This operation requires an n8n Enterprise license with project management features enabled. Error: ${errorJson.message}`;
          } else {
            errorMessage = errorJson.message || errorText;
          }
        } catch {
          errorMessage = errorText;
        }
        throw new Error(`N8N API error: ${errorMessage}`);
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {} as T;
      }

      return await response.json() as T;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to connect to n8n: ${error.message}`);
      }
      throw error;
    }
  }

  async listWorkflows(): Promise<N8nWorkflowList> {
    return this.makeRequest<N8nWorkflowList>('/workflows');
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}`);
  }

  async createWorkflow(name: string, nodes: any[] = [], connections: any = {}): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name,
        nodes,
        connections,
        settings: {
          saveManualExecutions: true,
          saveExecutionProgress: true,
        },
      }),
    });
  }

  async updateWorkflow(id: string, workflow: Partial<N8nWorkflow>): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workflow),
    });
  }

  async deleteWorkflow(id: string): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }

  // Project management methods (requires n8n Enterprise license)
  async listProjects(): Promise<N8nProjectList> {
    return this.makeRequest<N8nProjectList>('/projects');
  }

  async createProject(name: string): Promise<void> {
    return this.makeRequest<void>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    return this.makeRequest<void>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async updateProject(projectId: string, name: string): Promise<void> {
    return this.makeRequest<void>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  // User management methods
  async listUsers(): Promise<N8nUserList> {
    return this.makeRequest<N8nUserList>('/users');
  }

  async createUsers(users: Array<{ email: string; role?: 'global:admin' | 'global:member' }>): Promise<any> {
    return this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(users),
    });
  }

  async getUser(idOrEmail: string): Promise<N8nUser> {
    return this.makeRequest<N8nUser>(`/users/${idOrEmail}`);
  }

  async deleteUser(idOrEmail: string): Promise<void> {
    return this.makeRequest<void>(`/users/${idOrEmail}`, {
      method: 'DELETE',
    });
  }

  // Variable management methods
  async listVariables(): Promise<N8nVariableList> {
    return this.makeRequest<N8nVariableList>('/variables');
  }

  async createVariable(key: string, value: string): Promise<void> {
    return this.makeRequest<void>('/variables', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  }

  async deleteVariable(id: string): Promise<void> {
    return this.makeRequest<void>(`/variables/${id}`, {
      method: 'DELETE',
    });
  }

  // Execution management methods
  async getExecutions(options: { 
    includeData?: boolean; 
    status?: 'error' | 'success' | 'waiting';
    workflowId?: string;
    limit?: number;
  } = {}): Promise<N8nExecutionList> {
    const params = new URLSearchParams();
    if (options.includeData !== undefined) params.append('includeData', String(options.includeData));
    if (options.status) params.append('status', options.status);
    if (options.workflowId) params.append('workflowId', options.workflowId);
    if (options.limit) params.append('limit', String(options.limit));

    return this.makeRequest<N8nExecutionList>(`/executions?${params.toString()}`);
  }

  async getExecution(id: number, includeData: boolean = false): Promise<N8nExecution> {
    const params = new URLSearchParams();
    if (includeData) params.append('includeData', 'true');

    return this.makeRequest<N8nExecution>(`/executions/${id}?${params.toString()}`);
  }

  async deleteExecution(id: number): Promise<N8nExecution> {
    return this.makeRequest<N8nExecution>(`/executions/${id}`, {
      method: 'DELETE',
    });
  }

  // Tag management methods
  async createTag(name: string): Promise<N8nTag> {
    return this.makeRequest<N8nTag>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getTags(options: { limit?: number } = {}): Promise<N8nTagList> {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', String(options.limit));

    return this.makeRequest<N8nTagList>(`/tags?${params.toString()}`);
  }

  async getTag(id: string): Promise<N8nTag> {
    return this.makeRequest<N8nTag>(`/tags/${id}`);
  }

  async updateTag(id: string, name: string): Promise<N8nTag> {
    return this.makeRequest<N8nTag>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async deleteTag(id: string): Promise<N8nTag> {
    return this.makeRequest<N8nTag>(`/tags/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkflowTags(workflowId: string): Promise<N8nTag[]> {
    return this.makeRequest<N8nTag[]>(`/workflows/${workflowId}/tags`);
  }

  async updateWorkflowTags(workflowId: string, tagIds: { id: string }[]): Promise<N8nTag[]> {
    return this.makeRequest<N8nTag[]>(`/workflows/${workflowId}/tags`, {
      method: 'PUT',
      body: JSON.stringify(tagIds),
    });
  }

  // Security audit method
  async generateAudit(options: {
    daysAbandonedWorkflow?: number;
    categories?: Array<'credentials' | 'database' | 'nodes' | 'filesystem' | 'instance'>;
  } = {}): Promise<N8nAuditResult> {
    return this.makeRequest<N8nAuditResult>('/audit', {
      method: 'POST',
      body: JSON.stringify({
        additionalOptions: {
          daysAbandonedWorkflow: options.daysAbandonedWorkflow,
          categories: options.categories,
        },
      }),
    });
  }

  // Credential management methods
  async createCredential(name: string, type: string, data: Record<string, any>): Promise<any> {
    return this.makeRequest('/credentials', {
      method: 'POST',
      body: JSON.stringify({
        name,
        type,
        data
      }),
    });
  }

  async deleteCredential(id: string): Promise<any> {
    return this.makeRequest(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }

  async getCredentialSchema(credentialTypeName: string): Promise<any> {
    return this.makeRequest(`/credentials/schema/${credentialTypeName}`);
  }
}

// Create an MCP server
const server = new Server(
  {
    name: "n8n-integration",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Store client instances
const clients = new Map<string, N8nClient>();

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "init-n8n",
        description: "Initialize connection to n8n instance. Use this tool whenever an n8n URL and API key are shared to establish the connection. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string" },
            apiKey: { type: "string" }
          },
          required: ["url", "apiKey"]
        }
      },
      {
        name: "list-workflows",
        description: "List all workflows from n8n. Use after init-n8n to see available workflows. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "get-workflow",
        description: "Retrieve a workflow by ID. Use after list-workflows to get detailed information about a specific workflow. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "create-workflow",
        description: "Create a new workflow in n8n. Use to set up a new workflow with optional nodes and connections. IMPORTANT: 1) Arguments must be provided as compact, single-line JSON without whitespace or newlines. 2) Must provide full workflow structure including nodes and connections arrays, even if empty. The 'active' property should not be included as it is read-only.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            name: { type: "string" },
            nodes: { type: "array" },
            connections: { type: "object" }
          },
          required: ["clientId", "name"]
        }
      },
      {
        name: "update-workflow",
        description: "Update an existing workflow in n8n. Use after get-workflow to modify a workflow's properties, nodes, or connections. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" },
            workflow: {
              type: "object",
              properties: {
                name: { type: "string" },
                active: { type: "boolean" },
                nodes: { type: "array" },
                connections: { type: "object" },
                settings: { type: "object" }
              }
            }
          },
          required: ["clientId", "id", "workflow"]
        }
      },
      {
        name: "delete-workflow",
        description: "Delete a workflow by ID. This action cannot be undone. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "activate-workflow",
        description: "Activate a workflow by ID. This will enable the workflow to run. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "deactivate-workflow",
        description: "Deactivate a workflow by ID. This will prevent the workflow from running. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "list-projects",
        description: "List all projects from n8n. NOTE: Requires n8n Enterprise license with project management features enabled. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "create-project",
        description: "Create a new project in n8n. NOTE: Requires n8n Enterprise license with project management features enabled. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            name: { type: "string" }
          },
          required: ["clientId", "name"]
        }
      },
      {
        name: "delete-project",
        description: "Delete a project by ID. NOTE: Requires n8n Enterprise license with project management features enabled. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            projectId: { type: "string" }
          },
          required: ["clientId", "projectId"]
        }
      },
      {
        name: "update-project",
        description: "Update a project's name. NOTE: Requires n8n Enterprise license with project management features enabled. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            projectId: { type: "string" },
            name: { type: "string" }
          },
          required: ["clientId", "projectId", "name"]
        }
      },
      {
        name: "list-users",
        description: "Retrieve all users from your instance. Only available for the instance owner.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "create-users",
        description: "Create one or more users in your instance.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            users: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  role: { 
                    type: "string",
                    enum: ["global:admin", "global:member"]
                  }
                },
                required: ["email"]
              }
            }
          },
          required: ["clientId", "users"]
        }
      },
      {
        name: "get-user",
        description: "Get user by ID or email address.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            idOrEmail: { type: "string" }
          },
          required: ["clientId", "idOrEmail"]
        }
      },
      {
        name: "delete-user",
        description: "Delete a user from your instance.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            idOrEmail: { type: "string" }
          },
          required: ["clientId", "idOrEmail"]
        }
      },
      {
        name: "list-variables",
        description: "List all variables from n8n. NOTE: Requires n8n Enterprise license with variable management features enabled. Use after init-n8n to see available variables. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "create-variable",
        description: "Create a new variable in n8n. NOTE: Requires n8n Enterprise license with variable management features enabled. Variables can be used across workflows to store and share data. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            key: { type: "string" },
            value: { type: "string" }
          },
          required: ["clientId", "key", "value"]
        }
      },
      {
        name: "delete-variable",
        description: "Delete a variable by ID. NOTE: Requires n8n Enterprise license with variable management features enabled. Use after list-variables to get the ID of the variable to delete. This action cannot be undone. IMPORTANT: Arguments must be provided as compact, single-line JSON without whitespace or newlines.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "create-credential",
        description: "Create a credential that can be used by nodes of the specified type. The credential type name can be found in the n8n UI when creating credentials (e.g., 'cloudflareApi', 'githubApi', 'slackOAuth2Api'). Use get-credential-schema first to see what fields are required for the credential type you want to create.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            data: { type: "object" }
          },
          required: ["clientId", "name", "type", "data"]
        }
      },
      {
        name: "delete-credential",
        description: "Delete a credential by ID. You must be the owner of the credentials.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "get-credential-schema",
        description: "Show credential data schema for a specific credential type. The credential type name can be found in the n8n UI when creating credentials (e.g., 'cloudflareApi', 'githubApi', 'slackOAuth2Api'). This will show you what fields are required for creating credentials of this type.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            credentialTypeName: { type: "string" }
          },
          required: ["clientId", "credentialTypeName"]
        }
      },
      // Execution Management Tools
      {
        name: "list-executions",
        description: "Retrieve all executions from your instance with optional filtering.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            includeData: { type: "boolean" },
            status: { 
              type: "string",
              enum: ["error", "success", "waiting"]
            },
            workflowId: { type: "string" },
            limit: { type: "number" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "get-execution",
        description: "Retrieve a specific execution by ID.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "number" },
            includeData: { type: "boolean" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "delete-execution",
        description: "Delete a specific execution by ID.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "number" }
          },
          required: ["clientId", "id"]
        }
      },
      // Tag Management Tools
      {
        name: "create-tag",
        description: "Create a new tag in your instance.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            name: { type: "string" }
          },
          required: ["clientId", "name"]
        }
      },
      {
        name: "list-tags",
        description: "Retrieve all tags from your instance.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            limit: { type: "number" }
          },
          required: ["clientId"]
        }
      },
      {
        name: "get-tag",
        description: "Retrieve a specific tag by ID.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "update-tag",
        description: "Update a tag's name.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" },
            name: { type: "string" }
          },
          required: ["clientId", "id", "name"]
        }
      },
      {
        name: "delete-tag",
        description: "Delete a tag by ID.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            id: { type: "string" }
          },
          required: ["clientId", "id"]
        }
      },
      {
        name: "get-workflow-tags",
        description: "Get tags associated with a workflow.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            workflowId: { type: "string" }
          },
          required: ["clientId", "workflowId"]
        }
      },
      {
        name: "update-workflow-tags",
        description: "Update tags associated with a workflow.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            workflowId: { type: "string" },
            tagIds: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            }
          },
          required: ["clientId", "workflowId", "tagIds"]
        }
      },
      // Security Audit Tool
      {
        name: "generate-audit",
        description: "Generate a security audit for your n8n instance.",
        inputSchema: {
          type: "object",
          properties: {
            clientId: { type: "string" },
            daysAbandonedWorkflow: { type: "number" },
            categories: {
              type: "array",
              items: {
                type: "string",
                enum: ["credentials", "database", "nodes", "filesystem", "instance"]
              }
            }
          },
          required: ["clientId"]
        }
      }
    ]
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "init-n8n": {
      const { url, apiKey } = args as { url: string; apiKey: string };
      try {
        const client = new N8nClient(url, apiKey);
        
        // Test connection by listing workflows
        await client.listWorkflows();
        
        // Generate a unique client ID
        const clientId = Buffer.from(url).toString('base64');
        clients.set(clientId, client);

        return {
          content: [{
            type: "text",
            text: `Successfully connected to n8n at ${url}. Use this client ID for future operations: ${clientId}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "list-workflows": {
      const { clientId } = args as { clientId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflows = await client.listWorkflows();
        const formattedWorkflows = workflows.data.map(wf => ({
          id: wf.id,
          name: wf.name,
          active: wf.active,
          created: wf.createdAt,
          updated: wf.updatedAt,
          tags: wf.tags,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedWorkflows, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-workflow": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflow = await client.getWorkflow(id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(workflow, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "update-workflow": {
      const { clientId, id, workflow } = args as {
        clientId: string;
        id: string;
        workflow: Partial<N8nWorkflow>;
      };

      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const updatedWorkflow = await client.updateWorkflow(id, workflow);
        return {
          content: [{
            type: "text",
            text: `Successfully updated workflow:\n${JSON.stringify(updatedWorkflow, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "create-workflow": {
      const { clientId, name, nodes = [], connections = {} } = args as {
        clientId: string;
        name: string;
        nodes?: any[];
        connections?: Record<string, any>;
      };

      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflow = await client.createWorkflow(name, nodes, connections);
        return {
          content: [{
            type: "text",
            text: `Successfully created workflow:\n${JSON.stringify(workflow, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-workflow": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflow = await client.deleteWorkflow(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted workflow:\n${JSON.stringify(workflow, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "activate-workflow": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflow = await client.activateWorkflow(id);
        return {
          content: [{
            type: "text",
            text: `Successfully activated workflow:\n${JSON.stringify(workflow, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "deactivate-workflow": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const workflow = await client.deactivateWorkflow(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deactivated workflow:\n${JSON.stringify(workflow, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "list-projects": {
      const { clientId } = args as { clientId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const projects = await client.listProjects();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(projects.data, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "create-project": {
      const { clientId, name } = args as { clientId: string; name: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.createProject(name);
        return {
          content: [{
            type: "text",
            text: `Successfully created project: ${name}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-project": {
      const { clientId, projectId } = args as { clientId: string; projectId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.deleteProject(projectId);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted project with ID: ${projectId}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "update-project": {
      const { clientId, projectId, name } = args as { clientId: string; projectId: string; name: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.updateProject(projectId, name);
        return {
          content: [{
            type: "text",
            text: `Successfully updated project ${projectId} with new name: ${name}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "list-users": {
      const { clientId } = args as { clientId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const users = await client.listUsers();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(users.data, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "create-users": {
      const { clientId, users } = args as { 
        clientId: string; 
        users: Array<{ 
          email: string; 
          role?: 'global:admin' | 'global:member'
        }> 
      };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const result = await client.createUsers(users);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-user": {
      const { clientId, idOrEmail } = args as { clientId: string; idOrEmail: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const user = await client.getUser(idOrEmail);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(user, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-user": {
      const { clientId, idOrEmail } = args as { clientId: string; idOrEmail: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.deleteUser(idOrEmail);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted user: ${idOrEmail}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "list-variables": {
      const { clientId } = args as { clientId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const variables = await client.listVariables();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(variables.data, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "create-variable": {
      const { clientId, key, value } = args as { clientId: string; key: string; value: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.createVariable(key, value);
        return {
          content: [{
            type: "text",
            text: `Successfully created variable with key: ${key}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-variable": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        await client.deleteVariable(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted variable with ID: ${id}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "create-credential": {
      const { clientId, name, type, data } = args as {
        clientId: string;
        name: string;
        type: string;
        data: Record<string, any>;
      };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const credential = await client.createCredential(name, type, data);
        return {
          content: [{
            type: "text",
            text: `Successfully created credential:\n${JSON.stringify(credential, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-credential": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const result = await client.deleteCredential(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted credential:\n${JSON.stringify(result, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-credential-schema": {
      const { clientId, credentialTypeName } = args as { clientId: string; credentialTypeName: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const schema = await client.getCredentialSchema(credentialTypeName);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(schema, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    // Execution Management Handlers
    case "list-executions": {
      const { clientId, includeData, status, workflowId, limit } = args as {
        clientId: string;
        includeData?: boolean;
        status?: 'error' | 'success' | 'waiting';
        workflowId?: string;
        limit?: number;
      };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const executions = await client.getExecutions({ includeData, status, workflowId, limit });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(executions.data, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-execution": {
      const { clientId, id, includeData } = args as { clientId: string; id: number; includeData?: boolean };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const execution = await client.getExecution(id, includeData);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(execution, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-execution": {
      const { clientId, id } = args as { clientId: string; id: number };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const execution = await client.deleteExecution(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted execution:\n${JSON.stringify(execution, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    // Tag Management Handlers
    case "create-tag": {
      const { clientId, name } = args as { clientId: string; name: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tag = await client.createTag(name);
        return {
          content: [{
            type: "text",
            text: `Successfully created tag:\n${JSON.stringify(tag, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "list-tags": {
      const { clientId, limit } = args as { clientId: string; limit?: number };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tags = await client.getTags({ limit });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tags.data, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-tag": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tag = await client.getTag(id);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tag, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "update-tag": {
      const { clientId, id, name } = args as { clientId: string; id: string; name: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tag = await client.updateTag(id, name);
        return {
          content: [{
            type: "text",
            text: `Successfully updated tag:\n${JSON.stringify(tag, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "delete-tag": {
      const { clientId, id } = args as { clientId: string; id: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tag = await client.deleteTag(id);
        return {
          content: [{
            type: "text",
            text: `Successfully deleted tag:\n${JSON.stringify(tag, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "get-workflow-tags": {
      const { clientId, workflowId } = args as { clientId: string; workflowId: string };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tags = await client.getWorkflowTags(workflowId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tags, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "update-workflow-tags": {
      const { clientId, workflowId, tagIds } = args as {
        clientId: string;
        workflowId: string;
        tagIds: { id: string }[];
      };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const tags = await client.updateWorkflowTags(workflowId, tagIds);
        return {
          content: [{
            type: "text",
            text: `Successfully updated workflow tags:\n${JSON.stringify(tags, null, 2)}`,
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    case "generate-audit": {
      const { clientId, daysAbandonedWorkflow, categories } = args as {
        clientId: string;
        daysAbandonedWorkflow?: number;
        categories?: Array<'credentials' | 'database' | 'nodes' | 'filesystem' | 'instance'>;
      };
      const client = clients.get(clientId);
      if (!client) {
        return {
          content: [{
            type: "text",
            text: "Client not initialized. Please run init-n8n first.",
          }],
          isError: true
        };
      }

      try {
        const audit = await client.generateAudit({ daysAbandonedWorkflow, categories });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(audit, null, 2),
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: error instanceof Error ? error.message : "Unknown error occurred",
          }],
          isError: true
        };
      }
    }

    default:
      return {
        content: [{
          type: "text",
          text: `Unknown tool: ${name}`,
        }],
        isError: true
      };
  }
});

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("N8N MCP Server running on stdio");
