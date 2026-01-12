import { useRef, useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import type { MessageWithParts, Part, TextPart, ToolPart, SessionStatus, AssistantMessage, FullProvider, FullModel, OpenCodeConfig } from "../lib/types";
import { formatTime, getToolStatusIcon } from "../lib/utils";
import { StatusBar } from "./StatusBar";

interface ChatViewProps {
  messages: MessageWithParts[];
  status: SessionStatus;
  providers: FullProvider[];
  config?: OpenCodeConfig | null;
  projectDirectory?: string;
  onSendMessage: (message: string) => Promise<boolean>;
  onAbort: () => Promise<boolean>;
  onModelChange?: (providerID: string, modelID: string) => Promise<boolean>;
}

// Common OpenCode commands
const SLASH_COMMANDS = [
  { command: "/model", description: "Change model", hasArg: true },
  { command: "/agent", description: "Switch agent (coder/task)", hasArg: true },
  { command: "/compact", description: "Compact conversation" },
  { command: "/clear", description: "Clear conversation" },
  { command: "/undo", description: "Undo last action" },
  { command: "/diff", description: "Show all file changes" },
  { command: "/cost", description: "Show token costs" },
  { command: "/bug", description: "Report a bug" },
  { command: "/help", description: "Show help" },
];

interface ModelOption {
  provider: FullProvider;
  model: FullModel;
  displayName: string;
  isConfigured?: boolean;
  isCurrent?: boolean;
}

interface ProjectFile {
  path: string;
  name: string;
  is_dir: boolean;
}

function renderParts(parts: Part[]) {
  const textParts = parts.filter((p): p is TextPart => p.type === "text" && !p.synthetic);
  const toolParts = parts.filter((p): p is ToolPart => p.type === "tool");

  return (
    <>
      {textParts.map((part) => (
        <div key={part.id} className="message-text">
          <ReactMarkdown>{part.text}</ReactMarkdown>
        </div>
      ))}
      {toolParts.length > 0 && (
        <div className="tool-calls">
          {toolParts.map((part) => (
            <ToolCallView key={part.id} part={part} />
          ))}
        </div>
      )}
    </>
  );
}

// Separate component for tool calls to handle state
function ToolCallView({ part }: { part: ToolPart }) {
  const [expanded, setExpanded] = useState(false);
  const isEditable = ["edit", "write", "read", "bash", "grep", "glob"].includes(part.tool.toLowerCase());
  const hasOutput = part.state.status === "completed" && "output" in part.state && part.state.output;

  return (
    <div className={`tool-call status-${part.state.status}`}>
      <button
        type="button"
        className="tool-header"
        onClick={() => isEditable && hasOutput && setExpanded(!expanded)}
        disabled={!isEditable || !hasOutput}
      >
        <span className="tool-icon">{getToolStatusIcon(part.state.status)}</span>
        <span className="tool-name">{part.tool}</span>
        {(part.state.status === "running" || part.state.status === "completed") &&
          "title" in part.state && part.state.title && (
          <span className="tool-title">{part.state.title}</span>
        )}
        {isEditable && hasOutput && (
          <span className={`tool-expand ${expanded ? "expanded" : ""}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        )}
      </button>
      {part.state.status === "error" && (
        <div className="tool-error">{part.state.error}</div>
      )}
      {expanded && hasOutput && part.state.status === "completed" && (
        <div className="tool-output">
          <pre>{part.state.output.slice(0, 2000)}{part.state.output.length > 2000 ? "\n..." : ""}</pre>
        </div>
      )}
    </div>
  );
}

type SuggestionMode = "commands" | "models" | "files" | null;

export function ChatView({ messages, status, providers, config, projectDirectory, onSendMessage, onAbort, onModelChange }: ChatViewProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [fileQuery, setFileQuery] = useState("");
  const [atPosition, setAtPosition] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract model info from the last assistant message
  const modelInfo = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.info.role === "assistant") {
        const assistantMsg = msg.info as AssistantMessage;
        // Find provider name from providers list
        const provider = providers.find(p => p.id === assistantMsg.providerID);
        const model = provider?.models[assistantMsg.modelID];
        return {
          modelID: assistantMsg.modelID,
          modelName: model?.name || assistantMsg.modelID,
          providerID: assistantMsg.providerID,
          providerName: provider?.name || assistantMsg.providerID,
          agentMode: assistantMsg.mode || assistantMsg.agent,
        };
      }
    }
    return null;
  }, [messages, providers]);

  // Get the currently configured model from config
  const configuredModelId = config?.model;

  // Build flattened list of all models with configured status
  const allModels = useMemo((): ModelOption[] => {
    const models: ModelOption[] = [];
    for (const provider of providers) {
      for (const modelId of Object.keys(provider.models)) {
        const model = provider.models[modelId];
        const isConfigured = configuredModelId === model.id;
        const isCurrent = modelInfo?.modelID === model.id && modelInfo?.providerID === provider.id;
        models.push({
          provider,
          model,
          displayName: `${provider.name} / ${model.name}`,
          isConfigured,
          isCurrent,
        });
      }
    }
    return models;
  }, [providers, configuredModelId, modelInfo]);

  // Filter commands based on input (when typing /something)
  const filteredCommands = useMemo(() => {
    if (!inputMessage.startsWith("/")) return [];
    // If we're in model selection mode (after "/model "), don't show commands
    if (inputMessage.toLowerCase().startsWith("/model ")) return [];
    const search = inputMessage.toLowerCase();
    return SLASH_COMMANDS.filter(c => c.command.toLowerCase().startsWith(search));
  }, [inputMessage]);

  // Organized models: configured first, then by provider
  const organizedModels = useMemo(() => {
    // Get search query
    const match = inputMessage.match(/^\/model\s*(.*)$/i);
    const search = match ? match[1].toLowerCase().trim() : "";

    // Filter models by search
    let filtered = allModels;
    if (search) {
      filtered = allModels.filter(m =>
        m.model.name.toLowerCase().includes(search) ||
        m.model.id.toLowerCase().includes(search) ||
        m.provider.name.toLowerCase().includes(search)
      );
    }

    // Sort: configured/current first, then alphabetically by provider and model name
    const sorted = [...filtered].sort((a, b) => {
      // Current model first
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      // Then configured model
      if (a.isConfigured && !b.isConfigured) return -1;
      if (!a.isConfigured && b.isConfigured) return 1;
      // Then by provider name
      const providerCompare = a.provider.name.localeCompare(b.provider.name);
      if (providerCompare !== 0) return providerCompare;
      // Then by model name
      return a.model.name.localeCompare(b.model.name);
    });

    return sorted.slice(0, 25);
  }, [inputMessage, allModels]);

  // Keep filteredModels for backward compatibility
  const filteredModels = organizedModels;

  // Auto-scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll should trigger on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch project files when in files mode
  useEffect(() => {
    if (suggestionMode !== "files" || !projectDirectory) {
      return;
    }

    const fetchFiles = async () => {
      try {
        const files = await invoke<ProjectFile[]>("list_project_files", {
          directory: projectDirectory,
          query: fileQuery,
          limit: 20,
        });
        setProjectFiles(files);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Failed to fetch project files:", err);
        setProjectFiles([]);
      }
    };

    const timeoutId = setTimeout(fetchFiles, 100);
    return () => clearTimeout(timeoutId);
  }, [suggestionMode, projectDirectory, fileQuery]);

  // Detect @ for file mentions
  const detectAtMention = (text: string, cursorPos: number) => {
    // Find the last @ before cursor
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      return { isAtMention: false, query: "", position: -1 };
    }

    // Check if @ is at start or preceded by space
    if (atIndex > 0 && textBeforeCursor[atIndex - 1] !== " ") {
      return { isAtMention: false, query: "", position: -1 };
    }

    // Get the query after @
    const query = textBeforeCursor.slice(atIndex + 1);

    // If there's a space after the query part, we're no longer in mention mode
    if (query.includes(" ")) {
      return { isAtMention: false, query: "", position: -1 };
    }

    return { isAtMention: true, query, position: atIndex };
  };

  // Show/hide suggestions based on input
  useEffect(() => {
    const cursorPos = inputRef.current?.selectionStart ?? inputMessage.length;
    const { isAtMention, query, position } = detectAtMention(inputMessage, cursorPos);
    const lowerInput = inputMessage.toLowerCase().trim();

    if (isAtMention && projectDirectory) {
      setSuggestionMode("files");
      setFileQuery(query);
      setAtPosition(position);
      setSelectedIndex(0);
    } else if (lowerInput === "/model" || lowerInput.startsWith("/model ")) {
      // Show models when typing /model or /model <search>
      setSuggestionMode("models");
      setSelectedIndex(0);
      setAtPosition(-1);
    } else if (inputMessage.startsWith("/") && filteredCommands.length > 0) {
      setSuggestionMode("commands");
      setSelectedIndex(0);
      setAtPosition(-1);
    } else {
      setSuggestionMode(null);
      setAtPosition(-1);
    }
  }, [inputMessage, filteredCommands.length, projectDirectory]);

  const handleSend = async () => {
    if (!inputMessage.trim()) return;
    const message = inputMessage;
    // Clear input immediately for better UX
    setInputMessage("");
    setSuggestionMode(null);
    setAtPosition(-1);
    await onSendMessage(message);
  };

  const handleSelectCommand = (command: string) => {
    const cmd = SLASH_COMMANDS.find(c => c.command === command);
    if (command === "/model") {
      // For /model, set the input and let the effect show models
      setInputMessage("/model");
      setSuggestionMode("models");
      setSelectedIndex(0);
    } else if (cmd?.hasArg) {
      setInputMessage(command + " ");
      setSuggestionMode(null);
    } else {
      // Clear and send immediately
      setInputMessage("");
      setSuggestionMode(null);
      onSendMessage(command);
    }
    inputRef.current?.focus();
  };

  const handleSelectModel = async (modelOption: ModelOption) => {
    setInputMessage("");
    setSuggestionMode(null);

    if (onModelChange) {
      // Use API to change model - sends providerID and modelID separately
      await onModelChange(modelOption.provider.id, modelOption.model.id);
    } else {
      // Fallback: send as command (old behavior)
      onSendMessage(`/model ${modelOption.provider.id}/${modelOption.model.id}`);
    }
    inputRef.current?.focus();
  };

  const handleSelectFile = (file: ProjectFile) => {
    // Replace @query with @filepath
    const before = inputMessage.slice(0, atPosition);
    const cursorPos = inputRef.current?.selectionStart ?? inputMessage.length;
    const after = inputMessage.slice(cursorPos);
    const newMessage = `${before}@${file.path} ${after}`.trim();

    setInputMessage(newMessage);
    setSuggestionMode(null);
    setAtPosition(-1);
    inputRef.current?.focus();

    // Set cursor after the inserted file path
    setTimeout(() => {
      const newPos = before.length + file.path.length + 2; // +2 for @ and space
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const getCurrentItems = () => {
    if (suggestionMode === "models") return filteredModels;
    if (suggestionMode === "files") return projectFiles;
    return filteredCommands;
  };

  const currentItems = getCurrentItems();
  const maxIndex = Math.max(0, currentItems.length - 1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestionMode) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, maxIndex));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === "Tab" || e.key === "Enter") {
        if (currentItems.length > 0) {
          e.preventDefault();
          if (suggestionMode === "models") {
            handleSelectModel(filteredModels[selectedIndex]);
          } else if (suggestionMode === "files") {
            handleSelectFile(projectFiles[selectedIndex]);
          } else {
            handleSelectCommand(filteredCommands[selectedIndex].command);
          }
        } else if (e.key === "Enter" && suggestionMode === "files") {
          // No files found, just send the message
          e.preventDefault();
          handleSend();
        }
      } else if (e.key === "Escape") {
        setSuggestionMode(null);
        setAtPosition(-1);
      }
    } else if (e.key === "Enter") {
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };

  return (
    <div className="chat fade-in">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.info.id} className={`message ${msg.info.role}`}>
            <div className="message-header">
              <span className="message-role">{msg.info.role === "user" ? "You" : "Assistant"}</span>
              <span className="message-time">{formatTime(msg.info.time.created)}</span>
            </div>
            <div className="message-content">
              {renderParts(msg.parts)}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="empty">
            <p>No messages yet</p>
            <p className="empty-hint">Type / for commands, @ to mention files</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <StatusBar
        status={status}
        providerName={modelInfo?.providerName}
        modelName={modelInfo?.modelName}
      />
      <div className="chat-input">
        {suggestionMode === "commands" && (
          <div className="command-suggestions">
            {filteredCommands.map((cmd, index) => (
              <button
                key={cmd.command}
                type="button"
                className={`command-item ${index === selectedIndex ? "selected" : ""}`}
                onClick={() => handleSelectCommand(cmd.command)}
              >
                <span className="command-name">{cmd.command}</span>
                <span className="command-desc">{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        {suggestionMode === "models" && (
          <div className="command-suggestions model-suggestions">
            <div className="suggestions-header">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 1L2 4v8l6 3 6-3V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 4l6 3 6-3M8 7v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Select a model
            </div>
            {filteredModels.length > 0 ? (
              filteredModels.map((modelOption, index) => (
                <button
                  key={`${modelOption.provider.id}-${modelOption.model.id}`}
                  type="button"
                  className={`command-item model-item ${index === selectedIndex ? "selected" : ""} ${modelOption.isCurrent ? "current" : ""}`}
                  onClick={() => handleSelectModel(modelOption)}
                >
                  <span className="model-info">
                    <span className="model-name">
                      {modelOption.model.name}
                      {modelOption.isCurrent && <span className="model-badge current">current</span>}
                      {modelOption.isConfigured && !modelOption.isCurrent && <span className="model-badge configured">configured</span>}
                      {modelOption.model.capabilities?.reasoning && <span className="model-badge reasoning">reasoning</span>}
                    </span>
                    <span className="model-provider">{modelOption.provider.name}</span>
                  </span>
                  <span className="model-id">{modelOption.model.id}</span>
                </button>
              ))
            ) : (
              <div className="suggestions-empty">
                No models found
              </div>
            )}
          </div>
        )}
        {suggestionMode === "files" && (
          <div className="command-suggestions file-suggestions">
            <div className="suggestions-header">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 2h5l1 1.5h4a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Select a file
            </div>
            {projectFiles.length > 0 ? (
              projectFiles.map((file, index) => (
                <button
                  key={file.path}
                  type="button"
                  className={`command-item file-item ${index === selectedIndex ? "selected" : ""}`}
                  onClick={() => handleSelectFile(file)}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="file-icon">
                    <path d="M4 2h5l3 3v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="file-path">{file.path}</span>
                </button>
              ))
            ) : (
              <div className="suggestions-empty">
                {fileQuery ? `No files matching "${fileQuery}"` : "Type to search files..."}
              </div>
            )}
          </div>
        )}
        {status === "busy" ? (
          <button type="button" className="abort-btn" onClick={onAbort}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/>
            </svg>
            <span>Stop</span>
          </button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a message, / for commands, @ for files..."
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="send-btn"
              onClick={handleSend}
              disabled={!inputMessage.trim()}
              aria-label="Send message"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
