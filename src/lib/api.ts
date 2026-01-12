import type { OpenCodeInstance, Session, SessionState, FileDiff, MessageWithParts, Part, OpenCodeConfig, MCPServer, FullProvider, TodoItem } from "./types";

const DEFAULT_PORT = 4096;
const MAX_PORT_SCAN = 10;

// Health response from OpenCode
interface HealthResponse {
  healthy: boolean;
  version: string;
}

// Path response from OpenCode
interface PathResponse {
  home: string;
  state: string;
  config: string;
  worktree: string;
  directory: string;
}

// Project response from OpenCode
interface ProjectResponse {
  id: string;
  path: string;
  name?: string;
  icon?: string;
  color?: string;
}

// Scan for OpenCode instances on local ports
export async function discoverInstances(): Promise<OpenCodeInstance[]> {
  const instances: OpenCodeInstance[] = [];
  
  // Scan ports in parallel for faster discovery
  const portChecks = Array.from({ length: MAX_PORT_SCAN }, (_, i) => DEFAULT_PORT + i);
  
  const results = await Promise.allSettled(
    portChecks.map(async (port) => {
      const url = `http://127.0.0.1:${port}`;
      
      // Check health first
      const healthRes = await fetch(`${url}/global/health`, {
        method: "GET",
        signal: AbortSignal.timeout(1000),
      });
      
      if (!healthRes.ok) return null;
      
      const health: HealthResponse = await healthRes.json();
      if (!health.healthy) return null;
      
      // Get directory from /path endpoint
      let directory = "Unknown";
      try {
        const pathRes = await fetch(`${url}/path`, {
          method: "GET",
          signal: AbortSignal.timeout(1000),
        });
        
        if (pathRes.ok) {
          const pathData: PathResponse = await pathRes.json();
          directory = pathData.directory;
        }
      } catch {
        // Try /project/current as fallback
        try {
          const projectRes = await fetch(`${url}/project/current`, {
            method: "GET",
            signal: AbortSignal.timeout(1000),
          });
          
          if (projectRes.ok) {
            const project: ProjectResponse = await projectRes.json();
            directory = project.path;
          }
        } catch {
          // Keep "Unknown"
        }
      }
      
      return {
        url,
        port,
        directory,
        connected: true,
        version: health.version,
      } as OpenCodeInstance;
    })
  );
  
  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      instances.push(result.value);
    }
  }
  
  return instances;
}

// Fetch sessions from an OpenCode instance
export async function fetchSessions(instance: OpenCodeInstance): Promise<Session[]> {
  try {
    const response = await fetch(`${instance.url}/session`, {
      method: "GET",
      headers: {
        "x-opencode-directory": instance.directory,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }
    
    const sessions: Session[] = await response.json();
    return sessions;
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
}

// Fetch session details including messages with parts
export async function fetchSessionDetails(
  instance: OpenCodeInstance,
  sessionId: string
): Promise<SessionState | null> {
  try {
    const [sessionRes, messagesRes] = await Promise.all([
      fetch(`${instance.url}/session/${sessionId}`, {
        headers: { "x-opencode-directory": instance.directory },
      }),
      fetch(`${instance.url}/session/${sessionId}/message`, {
        headers: { "x-opencode-directory": instance.directory },
      }),
    ]);
    
    if (!sessionRes.ok || !messagesRes.ok) {
      return null;
    }
    
    const session = await sessionRes.json();
    const messages: MessageWithParts[] = await messagesRes.json();
    
    return {
      session,
      status: "idle",
      messages,
    };
  } catch (error) {
    console.error("Error fetching session details:", error);
    return null;
  }
}

// Fetch diffs for a session
export async function fetchSessionDiffs(
  instance: OpenCodeInstance,
  sessionId: string
): Promise<FileDiff[]> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}/diff`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const diffs: FileDiff[] = await response.json();
    return diffs;
  } catch (error) {
    console.error("Error fetching diffs:", error);
    return [];
  }
}

// Reply to a permission request
export async function replyPermission(
  instance: OpenCodeInstance,
  _sessionId: string,
  requestId: string,
  reply: "once" | "always" | "reject"
): Promise<boolean> {
  try {
    const response = await fetch(
      `${instance.url}/permission/${requestId}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-opencode-directory": instance.directory,
        },
        body: JSON.stringify({ reply }),
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error("Error replying to permission:", error);
    return false;
  }
}

// Send a chat message
export async function sendMessage(
  instance: OpenCodeInstance,
  sessionId: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-opencode-directory": instance.directory,
      },
      body: JSON.stringify({
        parts: [{ type: "text", text: message }],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

// Change the model for a session (sends a prompt with model parameter)
// The model change takes effect when you send the next message
export async function changeSessionModel(
  instance: OpenCodeInstance,
  sessionId: string,
  providerID: string,
  modelID: string
): Promise<boolean> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-opencode-directory": instance.directory,
      },
      body: JSON.stringify({
        model: {
          providerID,
          modelID,
        },
        parts: [{ type: "text", text: "/model" }],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error changing model:", error);
    return false;
  }
}

// Callback types for SSE events
export interface SSECallbacks {
  onMessageUpdated?: (sessionId: string, messageId: string, info: unknown) => void;
  onPartUpdated?: (sessionId: string, messageId: string, part: Part, delta?: string) => void;
  onPartRemoved?: (sessionId: string, messageId: string, partId: string) => void;
  onSessionUpdated?: (session: Session) => void;
  onPermissionAsked?: (request: { id: string; sessionID: string; permission: string; patterns: string[] }) => void;
  onPermissionReplied?: (sessionId: string, requestId: string) => void;
  onStatusChanged?: (sessionId: string, status: "idle" | "busy" | "retry") => void;
}

// Subscribe to SSE events with debounced session updates
export function subscribeToEvents(
  instance: OpenCodeInstance,
  callbacks: SSECallbacks
): () => void {
  const eventSource = new EventSource(`${instance.url}/global/event`);
  
  // Debounce session updates to batch rapid changes
  let sessionUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingSessionUpdates = new Map<string, Session>();
  
  const flushSessionUpdates = () => {
    if (pendingSessionUpdates.size > 0 && callbacks.onSessionUpdated) {
      pendingSessionUpdates.forEach((session) => {
        callbacks.onSessionUpdated!(session);
      });
      pendingSessionUpdates.clear();
    }
  };
  
  const debouncedSessionUpdate = (session: Session) => {
    pendingSessionUpdates.set(session.id, session);
    if (sessionUpdateTimeout) {
      clearTimeout(sessionUpdateTimeout);
    }
    // Flush updates after 100ms of no new updates
    sessionUpdateTimeout = setTimeout(flushSessionUpdates, 100);
  };
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const payload = data.payload || data;
      const type = payload.type;
      const properties = payload.properties || {};
      
      switch (type) {
        case "message.updated":
          callbacks.onMessageUpdated?.(
            properties.info.sessionID,
            properties.info.id,
            properties.info
          );
          break;
          
        case "message.part.updated":
          callbacks.onPartUpdated?.(
            properties.part.sessionID,
            properties.part.messageID,
            properties.part,
            properties.delta
          );
          break;
          
        case "message.part.removed":
          callbacks.onPartRemoved?.(
            properties.sessionID,
            properties.messageID,
            properties.partID
          );
          break;
          
        case "session.updated":
          // Use debounced update to batch rapid session updates
          debouncedSessionUpdate(properties as Session);
          break;
          
        case "permission.asked":
          callbacks.onPermissionAsked?.(properties);
          break;
          
        case "permission.replied":
          callbacks.onPermissionReplied?.(properties.sessionID, properties.id);
          break;
          
        case "session.status":
          callbacks.onStatusChanged?.(properties.sessionID, properties.status);
          break;
          
        case "server.connected":
          console.log("Connected to OpenCode SSE");
          break;
          
        case "server.heartbeat":
          break;
      }
    } catch (error) {
      console.error("Error parsing SSE event:", error);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error("SSE error:", error);
  };
  
  return () => {
    if (sessionUpdateTimeout) {
      clearTimeout(sessionUpdateTimeout);
    }
    flushSessionUpdates(); // Flush any pending updates before closing
    eventSource.close();
  };
}

// Abort current session
export async function abortSession(
  instance: OpenCodeInstance,
  sessionId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}/abort`, {
      method: "POST",
      headers: { "x-opencode-directory": instance.directory },
    });
    
    return response.ok;
  } catch (error) {
    console.error("Error aborting session:", error);
    return false;
  }
}

// Create a new session
export async function createSession(
  instance: OpenCodeInstance
): Promise<Session | null> {
  try {
    const response = await fetch(`${instance.url}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-opencode-directory": instance.directory,
      },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      return null;
    }
    
    const session: Session = await response.json();
    return session;
  } catch (error) {
    console.error("Error creating session:", error);
    return null;
  }
}

// Fetch OpenCode config
export async function fetchConfig(
  instance: OpenCodeInstance
): Promise<OpenCodeConfig | null> {
  try {
    const response = await fetch(`${instance.url}/config`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching config:", error);
    return null;
  }
}

// Fetch MCP servers
export async function fetchMCPServers(
  instance: OpenCodeInstance
): Promise<MCPServer[]> {
  try {
    const response = await fetch(`${instance.url}/mcp`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    // API returns empty object {} when no MCPs
    if (!data || typeof data !== "object" || Object.keys(data).length === 0) {
      return [];
    }
    
    // Convert object to array of MCPServer
    return Object.entries(data).map(([name, info]) => ({
      name,
      status: (info as { status?: string }).status === "connected" ? "connected" : "disconnected",
      tools: (info as { tools?: string[] }).tools || [],
    })) as MCPServer[];
  } catch (error) {
    console.error("Error fetching MCP servers:", error);
    return [];
  }
}

// Fetch all providers from OpenCode
export async function fetchProviders(
  instance: OpenCodeInstance
): Promise<FullProvider[]> {
  try {
    const response = await fetch(`${instance.url}/provider`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.all || [];
  } catch (error) {
    console.error("Error fetching providers:", error);
    return [];
  }
}

// Delete a session
export async function deleteSession(
  instance: OpenCodeInstance,
  sessionId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}`, {
      method: "DELETE",
      headers: { "x-opencode-directory": instance.directory },
    });
    
    return response.ok;
  } catch (error) {
    console.error("Error deleting session:", error);
    return false;
  }
}

// Update OpenCode config
export async function updateConfig(
  instance: OpenCodeInstance,
  config: Partial<OpenCodeConfig>
): Promise<OpenCodeConfig | null> {
  try {
    const response = await fetch(`${instance.url}/config`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-opencode-directory": instance.directory,
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      console.error("Failed to update config:", response.statusText);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating config:", error);
    return null;
  }
}

// Fetch provider auth methods
export interface ProviderAuthMethod {
  type: "oauth" | "api_key";
  name: string;
  env?: string;
  oauth?: {
    authorize_url: string;
    callback_url: string;
  };
}

export async function fetchProviderAuth(
  instance: OpenCodeInstance
): Promise<Record<string, ProviderAuthMethod[]>> {
  try {
    const response = await fetch(`${instance.url}/provider/auth`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return {};
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching provider auth:", error);
    return {};
  }
}

// Fetch todos for a session
export async function fetchTodos(
  instance: OpenCodeInstance,
  sessionId: string
): Promise<TodoItem[]> {
  try {
    const response = await fetch(`${instance.url}/session/${sessionId}/todo`, {
      headers: { "x-opencode-directory": instance.directory },
    });
    
    if (!response.ok) {
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching todos:", error);
    return [];
  }
}
