import { useState, useMemo, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Theme, OpenCodeConfig, MCPServer, OpenCodeInstance, FullProvider } from "../lib/types";
import { useSettings } from "../hooks";

type SettingsTab = "general" | "app" | "providers" | "mcp" | "config";

// MCP config types from opencode.json
interface LocalMCPConfig {
  type?: "remote" | "local";
  url?: string;
  command?: string;
  args?: string[];
  enabled?: boolean;
}

interface LocalConfigFile {
  mcp?: Record<string, LocalMCPConfig>;
}

interface SettingsViewProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  instance?: OpenCodeInstance | null;
  config?: OpenCodeConfig | null;
  mcpServers?: MCPServer[];
  providers?: FullProvider[];
  onConfigUpdate?: (config: Partial<OpenCodeConfig>) => Promise<boolean>;
}

const DEFAULT_OPENCODE_CONFIG = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "context7": {
      "type": "remote",
      "url": "https://mcp.context7.com/mcp",
      "enabled": true
    }
  }
}`;

export function SettingsView({ 
  theme, 
  onThemeChange, 
  instance,
  config,
  mcpServers = [],
  providers = [],
  onConfigUpdate,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // App settings hook
  const { settings: appSettings, updateSettings } = useSettings();

  // Shortcut editing state
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [shortcutKeys, setShortcutKeys] = useState<string[]>([]);
  const shortcutInputRef = useRef<HTMLButtonElement>(null);
  
  // Config editor state
  const [configExists, setConfigExists] = useState<boolean | null>(null);
  const [configContent, setConfigContent] = useState<string>("");
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  
  // Local MCPs from opencode.json
  const [localMcps, setLocalMcps] = useState<{ name: string; config: LocalMCPConfig }[]>([]);

  const configPath = instance?.directory ? `${instance.directory}/opencode.json` : null;

  // Load config file when instance changes
  useEffect(() => {
    if (!configPath) return;
    
    const loadConfig = async () => {
      try {
        const exists = await invoke<boolean>("file_exists", { path: configPath });
        setConfigExists(exists);
        
        if (exists) {
          const content = await invoke<string>("read_file", { path: configPath });
          setConfigContent(content);
          
          // Parse MCPs from config
          try {
            const parsed: LocalConfigFile = JSON.parse(content);
            if (parsed.mcp) {
              const mcps = Object.entries(parsed.mcp).map(([name, cfg]) => ({
                name,
                config: cfg
              }));
              setLocalMcps(mcps);
            } else {
              setLocalMcps([]);
            }
          } catch {
            setLocalMcps([]);
          }
        } else {
          setConfigContent(DEFAULT_OPENCODE_CONFIG);
          setLocalMcps([]);
        }
        setConfigError(null);
        setConfigDirty(false);
      } catch (err) {
        setConfigError(String(err));
      }
    };
    
    loadConfig();
  }, [configPath]);

  // Save config file
  const handleSaveConfig = async () => {
    if (!configPath) return;
    
    // Validate JSON
    let parsed: LocalConfigFile;
    try {
      parsed = JSON.parse(configContent);
    } catch {
      setConfigError("Invalid JSON syntax");
      return;
    }
    
    setConfigSaving(true);
    setConfigError(null);
    
    try {
      await invoke("write_file", { path: configPath, content: configContent });
      setConfigExists(true);
      setConfigDirty(false);
      
      // Update local MCPs after save
      if (parsed.mcp) {
        const mcps = Object.entries(parsed.mcp).map(([name, cfg]) => ({
          name,
          config: cfg
        }));
        setLocalMcps(mcps);
      } else {
        setLocalMcps([]);
      }
    } catch (err) {
      setConfigError(String(err));
    } finally {
      setConfigSaving(false);
    }
  };
  
  // Combine API MCPs with local MCPs
  const combinedMcps = useMemo(() => {
    const result: { name: string; status: string; type: string; url?: string; command?: string; tools?: string[] }[] = [];
    
    // First add MCPs from OpenCode API (they have real status)
    for (const server of mcpServers) {
      result.push({
        name: server.name,
        status: server.status,
        type: "running",
        tools: server.tools,
      });
    }
    
    // Then add local MCPs that aren't already in the API response
    for (const local of localMcps) {
      const existsInApi = mcpServers.some(s => s.name === local.name);
      if (!existsInApi) {
        result.push({
          name: local.name,
          status: local.config.enabled === false ? "disabled" : "configured",
          type: local.config.type || (local.config.command ? "local" : "remote"),
          url: local.config.url,
          command: local.config.command,
        });
      }
    }
    
    return result;
  }, [mcpServers, localMcps]);

  // Get configured providers from config
  const configuredProviders = config?.provider 
    ? Object.entries(config.provider).map(([id, info]) => ({
        id,
        name: info.name,
        modelCount: info.models ? Object.keys(info.models).length : 0
      }))
    : [];

  const totalModels = providers.reduce((sum, p) => sum + Object.keys(p.models).length, 0);
  const currentModel = config?.model || "Not set";

  const allModels = useMemo(() => {
    const models: { providerId: string; providerName: string; modelId: string; modelName: string; value: string }[] = [];
    for (const provider of providers) {
      for (const [modelId, model] of Object.entries(provider.models)) {
        models.push({
          providerId: provider.id,
          providerName: provider.name,
          modelId,
          modelName: model.name,
          value: `${provider.id}/${modelId}`,
        });
      }
    }
    return models;
  }, [providers]);

  const handleModelChange = async (model: string) => {
    if (!onConfigUpdate) return;
    setIsSaving(true);
    try {
      await onConfigUpdate({ model });
      setSelectedModel(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle shortcut key capture
  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const key = e.key;
    const modifiers: string[] = [];

    // Detect platform
    const isMac = (window as unknown as { __OPENTRAY__?: { platform?: string } }).__OPENTRAY__?.platform === "macos";

    if (e.metaKey && isMac) modifiers.push("Cmd");
    if (e.ctrlKey && !isMac) modifiers.push("Ctrl");
    if (e.ctrlKey && isMac) modifiers.push("Ctrl");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");

    // Map key names
    let keyName = key;
    if (key === " ") keyName = "Space";
    else if (key.length === 1) keyName = key.toUpperCase();
    else if (key === "ArrowUp") keyName = "Up";
    else if (key === "ArrowDown") keyName = "Down";
    else if (key === "ArrowLeft") keyName = "Left";
    else if (key === "ArrowRight") keyName = "Right";
    else if (key === "Escape") {
      setIsEditingShortcut(false);
      setShortcutKeys([]);
      return;
    }

    // Ignore modifier-only keys
    if (["Meta", "Control", "Alt", "Shift"].includes(key)) {
      setShortcutKeys(modifiers);
      return;
    }

    // Need at least one modifier + a key
    if (modifiers.length > 0) {
      const newShortcut = [...modifiers, keyName].join("+");
      setShortcutKeys([...modifiers, keyName]);

      // Save the shortcut and update it in real-time
      updateSettings({ global_shortcut: newShortcut });

      // Update the global shortcut immediately (no restart required)
      invoke("update_global_shortcut", { shortcutStr: newShortcut })
        .catch(err => console.error("Failed to update shortcut:", err));

      setIsEditingShortcut(false);
      setShortcutKeys([]);
    }
  };

  const handleShortcutBlur = () => {
    setIsEditingShortcut(false);
    setShortcutKeys([]);
  };

  const startEditingShortcut = () => {
    setIsEditingShortcut(true);
    setShortcutKeys([]);
    setTimeout(() => shortcutInputRef.current?.focus(), 0);
  };

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "app", label: "App" },
    { id: "providers", label: "Providers" },
    { id: "mcp", label: "MCP" },
    { id: "config", label: "Config" },
  ];

  return (
    <div className="settings fade-in">
      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-content">
        {/* General Tab */}
        {activeTab === "general" && (
          <>
            {instance && (
              <div className="settings-section">
                <h3 className="settings-section-title">Connection</h3>
                <div className="settings-item">
                  <span className="settings-label">Status</span>
                  <span className="settings-value settings-status connected">
                    <span className="status-indicator" />
                    Connected
                  </span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Port</span>
                  <span className="settings-value">{instance.port}</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Version</span>
                  <span className="settings-value">{instance.version || "Unknown"}</span>
                </div>
              </div>
            )}

            <div className="settings-section">
              <h3 className="settings-section-title">Active Model</h3>
              <button
                type="button"
                className="settings-item clickable"
                onClick={() => setSelectedModel(selectedModel ? null : currentModel)}
              >
                <span className="settings-label">Model</span>
                <span className="settings-value settings-model">
                  {currentModel}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              
              {selectedModel !== null && (
                <div className="model-selector">
                  <div className="model-selector-header">Select Model</div>
                  <div className="model-selector-list">
                    {allModels.map((m) => (
                      <button
                        type="button"
                        key={m.value}
                        className={`model-selector-item ${m.value === currentModel ? "active" : ""}`}
                        onClick={() => handleModelChange(m.value)}
                        disabled={isSaving}
                      >
                        <span className="model-selector-name">{m.modelName}</span>
                        <span className="model-selector-provider">{m.providerName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {config?.username && (
              <div className="settings-section">
                <h3 className="settings-section-title">User</h3>
                <div className="settings-item">
                  <span className="settings-label">Username</span>
                  <span className="settings-value">{config.username}</span>
                </div>
              </div>
            )}

            <div className="settings-section">
              <h3 className="settings-section-title">Appearance</h3>
              <div className="settings-item">
                <span className="settings-label">Theme</span>
                <div className="settings-control">
                  <select
                    value={theme}
                    onChange={(e) => onThemeChange(e.target.value as Theme)}
                    className="settings-select"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* App Tab */}
        {activeTab === "app" && (
          <>
            <div className="settings-section">
              <h3 className="settings-section-title">Startup</h3>
              <div className="settings-item">
                <span className="settings-label">Launch at Login</span>
                <div className="settings-control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={appSettings.autostart}
                      onChange={(e) => updateSettings({ autostart: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">Notifications</h3>
              <div className="settings-item">
                <span className="settings-label">Sound Effects</span>
                <div className="settings-control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={appSettings.sound_enabled}
                      onChange={(e) => updateSettings({ sound_enabled: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">Display</h3>
              <div className="settings-item">
                <span className="settings-label">Compact Mode</span>
                <div className="settings-control">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={appSettings.compact_mode}
                      onChange={(e) => updateSettings({ compact_mode: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">Keyboard Shortcut</h3>
              <div className="settings-item">
                <span className="settings-label">Toggle OpenTray</span>
                {isEditingShortcut ? (
                  <button
                    ref={shortcutInputRef}
                    type="button"
                    className="settings-shortcut-input editing"
                    onKeyDown={handleShortcutKeyDown}
                    onBlur={handleShortcutBlur}
                  >
                    {shortcutKeys.length > 0 ? shortcutKeys.join("+") : "Press keys..."}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="settings-shortcut-input"
                    onClick={startEditingShortcut}
                  >
                    {appSettings.global_shortcut}
                  </button>
                )}
              </div>
              <p className="settings-hint">
                Click to change. Press Escape to cancel.
              </p>
            </div>
          </>
        )}

        {/* Providers Tab */}
        {activeTab === "providers" && (
          <div className="settings-section">
            <div className="settings-item">
              <span className="settings-label">Total Providers</span>
              <span className="settings-value">{providers.length}</span>
            </div>
            <div className="settings-item">
              <span className="settings-label">Total Models</span>
              <span className="settings-value">{totalModels}</span>
            </div>
            {configuredProviders.length > 0 && (
              <div className="settings-item">
                <span className="settings-label">Custom Providers</span>
                <span className="settings-value">{configuredProviders.length}</span>
              </div>
            )}
            
            <div className="provider-list">
              {providers.map((provider) => {
                const isExpanded = expandedProvider === provider.id;
                const modelCount = Object.keys(provider.models).length;
                const isCustom = configuredProviders.some(p => p.id === provider.id);
                
                return (
                  <div key={provider.id} className="provider-item">
                    <button
                      type="button"
                      className="provider-header"
                      onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                    >
                      <span className={`provider-expand ${isExpanded ? "expanded" : ""}`}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <span className="provider-name">
                        {provider.name}
                        {isCustom && <span className="provider-custom-badge">Custom</span>}
                      </span>
                      <span className="provider-model-count">{modelCount} models</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="provider-models">
                        {Object.entries(provider.models).map(([modelId, model]) => (
                          <div key={modelId} className="provider-model">
                            <span className="provider-model-name">{model.name}</span>
                            <span className="provider-model-id">{modelId}</span>
                            {model.capabilities?.reasoning && (
                              <span className="provider-model-badge reasoning">Reasoning</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* MCP Tab */}
        {activeTab === "mcp" && (
          <div className="settings-section">
            {combinedMcps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <rect x="8" y="12" width="32" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="16" cy="24" r="3" stroke="currentColor" strokeWidth="2"/>
                    <circle cx="32" cy="24" r="3" stroke="currentColor" strokeWidth="2"/>
                    <path d="M19 24h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="empty-state-title">No MCP Servers</h3>
                <p className="empty-state-text">
                  MCP servers extend OpenCode with additional capabilities.
                  Configure them in the <strong>Config</strong> tab.
                </p>
                <button 
                  type="button" 
                  className="empty-state-btn"
                  onClick={() => setActiveTab("config")}
                >
                  Open Config
                </button>
              </div>
            ) : (
              <div className="mcp-list">
                {combinedMcps.map((server) => (
                  <div key={server.name} className="mcp-item">
                    <div className="mcp-header">
                      <span className={`mcp-status ${server.status}`}>
                        <span className="status-indicator" />
                      </span>
                      <span className="mcp-name">{server.name}</span>
                      <span className="mcp-status-text">{server.status}</span>
                    </div>
                    <div className="mcp-details">
                      {server.type && (
                        <span className="mcp-type">{server.type}</span>
                      )}
                      {server.url && (
                        <span className="mcp-url" title={server.url}>{server.url}</span>
                      )}
                      {server.command && (
                        <span className="mcp-command">{server.command}</span>
                      )}
                    </div>
                    {server.tools && server.tools.length > 0 && (
                      <div className="mcp-tools">
                        <span className="mcp-tools-label">Tools:</span>
                        <div className="mcp-tools-list">
                          {server.tools.slice(0, 5).map((tool) => (
                            <span key={tool} className="mcp-tool-badge">{tool}</span>
                          ))}
                          {server.tools.length > 5 && (
                            <span className="mcp-tool-badge more">+{server.tools.length - 5}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="settings-section config-section">
            {!instance ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path d="M12 8h24v32H12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M18 16h12M18 24h12M18 32h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="empty-state-title">No Instance Selected</h3>
                <p className="empty-state-text">
                  Select an OpenCode instance first to edit its configuration file.
                </p>
              </div>
            ) : (
              <>
                <div className="config-header">
                  <div className="config-info">
                    <svg className="config-file-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="config-filename">opencode.json</span>
                    {configExists === false && (
                      <span className="config-badge new">New</span>
                    )}
                    {configDirty && (
                      <span className="config-badge modified">Modified</span>
                    )}
                  </div>
                  {configPath && (
                    <span className="config-path" title={configPath}>
                      {instance.directory}
                    </span>
                  )}
                </div>

                {configError && (
                  <div className="config-error">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M7 4v3M7 9v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {configError}
                  </div>
                )}

                <div className="config-editor-wrapper">
                  <textarea
                    className="config-editor"
                    value={configContent}
                    onChange={(e) => {
                      setConfigContent(e.target.value);
                      setConfigDirty(true);
                      setConfigError(null);
                    }}
                    spellCheck={false}
                    placeholder={configExists === null ? "Loading..." : "Enter JSON configuration..."}
                  />
                </div>

                <div className="config-actions">
                  <button
                    type="button"
                    className="config-btn secondary"
                    onClick={() => {
                      setConfigContent(DEFAULT_OPENCODE_CONFIG);
                      setConfigDirty(true);
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="config-btn primary"
                    onClick={handleSaveConfig}
                    disabled={configSaving || !configDirty}
                  >
                    {configSaving ? "Saving..." : configExists ? "Save" : "Create"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
