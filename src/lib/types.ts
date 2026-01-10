// Types for OpenCode API integration

export interface Session {
  id: string;
  projectID: string;
  directory: string;
  title: string;
  time: {
    created: number;
    updated: number;
  };
  summary?: {
    additions: number;
    deletions: number;
    files: number;
    messages?: number;
  };
  archived?: boolean;
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}

// Message types
export interface UserMessage {
  id: string;
  sessionID: string;
  role: "user";
  time: {
    created: number;
  };
  summary?: {
    title?: string;
    body?: string;
    diffs: FileDiff[];
  };
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
  system?: string;
  tools?: { [key: string]: boolean };
  variant?: string;
}

export interface AssistantMessage {
  id: string;
  sessionID: string;
  role: "assistant";
  time: {
    created: number;
    completed?: number;
  };
  error?: MessageError;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;
  path: {
    cwd: string;
    root: string;
  };
  summary?: boolean;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  finish?: string;
}

export type Message = UserMessage | AssistantMessage;

// Error types
export interface MessageError {
  type: "provider_auth" | "unknown" | "output_length" | "aborted" | "api";
  message: string;
}

// Part types
export interface BasePart {
  id: string;
  sessionID: string;
  messageID: string;
}

export interface TextPart extends BasePart {
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: {
    start: number;
    end?: number;
  };
  metadata?: { [key: string]: unknown };
}

export interface ReasoningPart extends BasePart {
  type: "reasoning";
  text: string;
  metadata?: { [key: string]: unknown };
  time: {
    start: number;
    end?: number;
  };
}

export interface ToolStatePending {
  status: "pending";
  input: { [key: string]: unknown };
  raw: string;
}

export interface ToolStateRunning {
  status: "running";
  input: { [key: string]: unknown };
  title?: string;
  metadata?: { [key: string]: unknown };
  time: { start: number };
}

export interface ToolStateCompleted {
  status: "completed";
  input: { [key: string]: unknown };
  output: string;
  title: string;
  metadata: { [key: string]: unknown };
  time: {
    start: number;
    end: number;
    compacted?: number;
  };
  attachments?: FilePart[];
}

export interface ToolStateError {
  status: "error";
  input: { [key: string]: unknown };
  error: string;
  metadata?: { [key: string]: unknown };
  time: {
    start: number;
    end: number;
  };
}

export type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;

export interface ToolPart extends BasePart {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolState;
  metadata?: { [key: string]: unknown };
}

export interface FilePart extends BasePart {
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: unknown;
}

export interface StepStartPart extends BasePart {
  type: "step-start";
  snapshot?: string;
}

export interface StepFinishPart extends BasePart {
  type: "step-finish";
  reason: string;
  snapshot?: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface AgentPart extends BasePart {
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
}

export interface SnapshotPart extends BasePart {
  type: "snapshot";
  snapshot: string;
}

export interface PatchPart extends BasePart {
  type: "patch";
  hash: string;
  files: string[];
}

export interface RetryPart extends BasePart {
  type: "retry";
  attempt: number;
  error: { type: string; message: string };
  time: { created: number };
}

export interface CompactionPart extends BasePart {
  type: "compaction";
  auto: boolean;
}

export interface SubtaskPart extends BasePart {
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  command?: string;
}

export type Part =
  | TextPart
  | ReasoningPart
  | ToolPart
  | FilePart
  | StepStartPart
  | StepFinishPart
  | AgentPart
  | SnapshotPart
  | PatchPart
  | RetryPart
  | CompactionPart
  | SubtaskPart;

// Message with parts (API response format)
export interface MessageWithParts {
  info: Message;
  parts: Part[];
}

// Permission request
export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
}

export interface OpenCodeInstance {
  url: string;
  directory: string;
  port: number;
  connected: boolean;
  version?: string;
}

export type SessionStatus = "idle" | "busy" | "retry";

export interface SessionState {
  session: Session;
  status: SessionStatus;
  messages: MessageWithParts[];
  permissionRequest?: PermissionRequest;
}

export type View = "instances" | "sessions" | "chat" | "diffs" | "settings" | "archived";

export type Theme = "system" | "light" | "dark";

// Config and Model info
export interface ProviderModel {
  id: string;
  name: string;
  providerID: string;
  limit?: {
    context: number;
    output: number;
  };
  reasoning?: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: Record<string, ProviderModel>;
}

export interface OpenCodeConfig {
  model?: string;
  small_model?: string;
  default_agent?: string;
  provider?: Record<string, {
    name: string;
    api?: string;
    models?: Record<string, {
      name: string;
      limit?: { context: number; output: number };
    }>;
    options?: {
      apiKey?: string;
      baseURL?: string;
    };
  }>;
  username?: string;
}

// Todo item from session
export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

export interface MCPServer {
  name: string;
  status: "connected" | "disconnected" | "error";
  tools?: string[];
}

export interface InstanceInfo {
  config: OpenCodeConfig;
  providers: ProviderInfo[];
  mcpServers: MCPServer[];
}

// Full Provider from /provider API
export interface FullProvider {
  id: string;
  name: string;
  source: string;
  env: string[];
  models: Record<string, FullModel>;
}

export interface FullModel {
  id: string;
  name: string;
  providerID: string;
  family?: string;
  status?: string;
  limit?: {
    context: number;
    output: number;
  };
  capabilities?: {
    reasoning?: boolean;
    toolcall?: boolean;
    attachment?: boolean;
  };
}

// Grouped sessions by directory
export interface SessionGroup {
  directory: string;
  projectName: string;
  sessions: Session[];
  isActive: boolean;
}
