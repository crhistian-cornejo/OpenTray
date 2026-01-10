import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { OpenCodeInstance, Session, SessionState, FileDiff, Part, PermissionRequest, SessionStatus, MessageWithParts, OpenCodeConfig, MCPServer, FullProvider, TodoItem } from "../lib/types";
import {
  discoverInstances,
  fetchSessions,
  fetchSessionDetails,
  fetchSessionDiffs,
  subscribeToEvents,
  sendMessage,
  abortSession,
  replyPermission,
  createSession,
  fetchConfig,
  fetchMCPServers,
  fetchProviders,
  deleteSession,
  fetchTodos,
} from "../lib/api";

export interface UseOpenCodeReturn {
  // State
  instances: OpenCodeInstance[];
  selectedInstance: OpenCodeInstance | null;
  sessions: Session[];
  selectedSession: Session | null;
  sessionDetails: SessionState | null;
  diffs: FileDiff[];
  todos: TodoItem[];
  loading: boolean;
  error: string | null;
  permissionRequest: PermissionRequest | null;
  sessionStatus: SessionStatus;
  config: OpenCodeConfig | null;
  mcpServers: MCPServer[];
  providers: FullProvider[];
  showArchived: boolean;
  archivedSessions: Session[];
  
  // Actions
  selectInstance: (instance: OpenCodeInstance) => void;
  selectSession: (session: Session) => void;
  clearSession: () => void;
  clearInstance: () => void;
  refresh: () => Promise<void>;
  sendChatMessage: (message: string) => Promise<boolean>;
  abort: () => Promise<boolean>;
  respondToPermission: (reply: "once" | "always" | "reject") => Promise<boolean>;
  createNewSession: () => Promise<Session | null>;
  removeSession: (session: Session) => Promise<boolean>;
  refreshTodos: () => Promise<void>;
  archiveSession: (session: Session) => Promise<void>;
  bulkArchiveSessions: (sessions: Session[]) => Promise<void>;
  bulkDeleteSessions: (sessions: Session[]) => Promise<void>;
  unarchiveSession: (session: Session) => Promise<void>;
  deleteArchivedSession: (session: Session) => Promise<void>;
  bulkDeleteArchivedSessions: (sessions: Session[]) => Promise<void>;
  toggleShowArchived: () => void;
  sendNotification: (title: string, body: string) => Promise<void>;
}

export function useOpenCode(): UseOpenCodeReturn {
  const [instances, setInstances] = useState<OpenCodeInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<OpenCodeInstance | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionDetails, setSessionDetails] = useState<SessionState | null>(null);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("idle");
  const [config, setConfig] = useState<OpenCodeConfig | null>(null);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [providers, setProviders] = useState<FullProvider[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSessions, setArchivedSessions] = useState<Session[]>([]);
  
  // Refs for SSE callbacks - prevents re-creating SSE subscription when session changes
  const selectedSessionRef = useRef<Session | null>(null);
  const updateMessagePartRef = useRef<(messageId: string, part: Part) => void>(() => {});
  const addMessageRef = useRef<(sessionId: string, messageId: string, info: MessageWithParts["info"]) => void>(() => {});
  
  // Track previous status for notification logic
  const prevStatusRef = useRef<SessionStatus>("idle");

  // Load archived sessions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("archivedSessions");
    if (stored) {
      try {
        setArchivedSessions(JSON.parse(stored));
      } catch {}
    }
  }, []);

  // Update message part in state
  const updateMessagePart = useCallback((messageId: string, part: Part) => {
    setSessionDetails((prev) => {
      if (!prev) return prev;
      
      const messages = prev.messages.map((msg) => {
        if (msg.info.id !== messageId) return msg;
        
        const existingIndex = msg.parts.findIndex((p) => p.id === part.id);
        if (existingIndex >= 0) {
          const newParts = [...msg.parts];
          newParts[existingIndex] = part;
          return { ...msg, parts: newParts };
        } else {
          return { ...msg, parts: [...msg.parts, part] };
        }
      });
      
      return { ...prev, messages };
    });
  }, []);

  // Add a new message to the session
  const addMessage = useCallback((sessionId: string, messageId: string, info: MessageWithParts["info"]) => {
    setSessionDetails((prev) => {
      if (!prev || prev.session.id !== sessionId) return prev;
      
      // Check if message already exists
      const exists = prev.messages.some((m) => m.info.id === messageId);
      if (exists) return prev;
      
      const newMessage: MessageWithParts = {
        info,
        parts: [],
      };
      
      return {
        ...prev,
        messages: [...prev.messages, newMessage],
      };
    });
  }, []);
  
  // Keep refs updated for SSE callbacks
  useEffect(() => {
    selectedSessionRef.current = selectedSession;
  }, [selectedSession]);
  
  useEffect(() => {
    updateMessagePartRef.current = updateMessagePart;
    addMessageRef.current = addMessage;
  }, [updateMessagePart, addMessage]);

  // Discover instances on mount with aggressive initial discovery and smart polling
  useEffect(() => {
    let isMounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const discover = async (): Promise<OpenCodeInstance[]> => {
      if (!isMounted) return [];
      setLoading(true);
      try {
        const found = await discoverInstances();
        if (!isMounted) return [];
        setInstances(found);
        if (found.length === 1) {
          setSelectedInstance(found[0]);
        } else if (found.length === 0) {
          setError("No OpenCode instances found");
        } else {
          setError(null);
        }
        return found;
      } catch {
        if (isMounted) setError("Failed to discover instances");
        return [];
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    // Aggressive initial discovery: retry up to 3 times with 2s intervals if no instance found
    const initialDiscovery = async () => {
      let attempts = 0;
      const maxAttempts = 3;
      const retryDelay = 2000;
      
      while (isMounted && attempts < maxAttempts) {
        const found = await discover();
        if (found.length > 0) {
          break; // Found instance(s), stop retrying
        }
        attempts++;
        if (attempts < maxAttempts && isMounted) {
          await new Promise(resolve => {
            retryTimeoutId = setTimeout(resolve, retryDelay);
          });
        }
      }
      
      // Start regular polling after initial discovery completes
      // Use 10s interval for responsive detection, but only poll if no instance is selected
      // or if we want to detect new instances
      intervalId = setInterval(discover, 10000);
    };
    
    initialDiscovery();
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, []);

  // Fetch sessions and subscribe to SSE when instance is selected
  // NOTE: SSE subscription only depends on selectedInstance, not selectedSession
  // We use refs for selectedSession to avoid reconnecting on every session change
  useEffect(() => {
    if (!selectedInstance) return;
    
    const loadSessions = async () => {
      const data = await fetchSessions(selectedInstance);
      setSessions(data.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0)));
    };
    
    const loadConfig = async () => {
      const configData = await fetchConfig(selectedInstance);
      setConfig(configData);
    };
    
    const loadMCP = async () => {
      const mcpData = await fetchMCPServers(selectedInstance);
      setMcpServers(mcpData);
    };
    
    const loadProviders = async () => {
      const providerData = await fetchProviders(selectedInstance);
      setProviders(providerData);
    };
    
    loadSessions();
    loadConfig();
    loadMCP();
    loadProviders();
    
    // Subscribe to events - using refs for session-specific callbacks
    const unsubscribe = subscribeToEvents(selectedInstance, {
      onSessionUpdated: (session) => {
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === session.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = session;
            return updated.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0));
          }
          return [session, ...prev];
        });
      },
      onMessageUpdated: (sessionId, messageId, info) => {
        // Use ref to check current session without recreating subscription
        if (selectedSessionRef.current?.id === sessionId) {
          addMessageRef.current(sessionId, messageId, info as MessageWithParts["info"]);
        }
      },
      onPermissionAsked: (req) => {
        setPermissionRequest({
          id: req.id,
          sessionID: req.sessionID,
          permission: req.permission,
          patterns: req.patterns,
          metadata: {},
        });
      },
      onPermissionReplied: () => {
        setPermissionRequest(null);
      },
      onPartUpdated: (sessionId, messageId, part) => {
        // Use ref to check current session without recreating subscription
        if (selectedSessionRef.current?.id === sessionId) {
          updateMessagePartRef.current(messageId, part);
        }
      },
      onStatusChanged: (sessionId, status) => {
        // Use ref to check current session without recreating subscription
        if (selectedSessionRef.current?.id === sessionId) {
          setSessionStatus(status);
        }
      },
    });
    
    return unsubscribe;
  }, [selectedInstance]); // Only reconnect when instance changes, not session

  // Fetch session details when session is selected
  useEffect(() => {
    if (!selectedInstance || !selectedSession) return;
    
    const loadDetails = async () => {
      const details = await fetchSessionDetails(selectedInstance, selectedSession.id);
      setSessionDetails(details);
      const diffData = await fetchSessionDiffs(selectedInstance, selectedSession.id);
      setDiffs(diffData);
      const todoData = await fetchTodos(selectedInstance, selectedSession.id);
      setTodos(todoData);
    };
    loadDetails();
  }, [selectedInstance, selectedSession]);

  const selectInstance = useCallback((instance: OpenCodeInstance) => {
    setSelectedInstance(instance);
  }, []);

  const selectSession = useCallback((session: Session) => {
    setSelectedSession(session);
  }, []);

  const clearSession = useCallback(() => {
    setSelectedSession(null);
    setSessionDetails(null);
    setDiffs([]);
    setSessionStatus("idle");
  }, []);

  const clearInstance = useCallback(() => {
    setSelectedInstance(null);
    setSessions([]);
    clearSession();
  }, [clearSession]);

  const refresh = useCallback(async () => {
    if (!selectedInstance) {
      setLoading(true);
      const found = await discoverInstances();
      setInstances(found);
      setLoading(false);
    } else if (!selectedSession) {
      const data = await fetchSessions(selectedInstance);
      setSessions(data.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0)));
    } else {
      const details = await fetchSessionDetails(selectedInstance, selectedSession.id);
      setSessionDetails(details);
      const diffData = await fetchSessionDiffs(selectedInstance, selectedSession.id);
      setDiffs(diffData);
    }
  }, [selectedInstance, selectedSession]);

  const sendChatMessage = useCallback(async (message: string): Promise<boolean> => {
    if (!selectedInstance || !selectedSession) return false;
    return sendMessage(selectedInstance, selectedSession.id, message);
  }, [selectedInstance, selectedSession]);

  const abort = useCallback(async (): Promise<boolean> => {
    if (!selectedInstance || !selectedSession) return false;
    return abortSession(selectedInstance, selectedSession.id);
  }, [selectedInstance, selectedSession]);

  const respondToPermission = useCallback(async (reply: "once" | "always" | "reject"): Promise<boolean> => {
    if (!selectedInstance || !permissionRequest) return false;
    const result = await replyPermission(
      selectedInstance,
      permissionRequest.sessionID,
      permissionRequest.id,
      reply
    );
    if (result) {
      setPermissionRequest(null);
    }
    return result;
  }, [selectedInstance, permissionRequest]);

  const createNewSession = useCallback(async (): Promise<Session | null> => {
    if (!selectedInstance) return null;
    const session = await createSession(selectedInstance);
    if (session) {
      setSessions((prev) => [session, ...prev]);
    }
    return session;
  }, [selectedInstance]);

  const removeSession = useCallback(async (session: Session): Promise<boolean> => {
    if (!selectedInstance) return false;
    const result = await deleteSession(selectedInstance, session.id);
    if (result) {
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      // Clear selection if the deleted session was selected
      if (selectedSession?.id === session.id) {
        setSelectedSession(null);
        setSessionDetails(null);
        setDiffs([]);
        setSessionStatus("idle");
      }
    }
    return result;
  }, [selectedInstance, selectedSession]);
  
  const refreshTodos = useCallback(async (): Promise<void> => {
    if (!selectedInstance || !selectedSession) return;
    const todoData = await fetchTodos(selectedInstance, selectedSession.id);
    setTodos(todoData);
  }, [selectedInstance, selectedSession]);

  const archiveSession = useCallback(async (session: Session): Promise<void> => {
    const newArchived = [...archivedSessions, { ...session, archived: true }];
    setArchivedSessions(newArchived);
    localStorage.setItem("archivedSessions", JSON.stringify(newArchived));
    
    // Remove from current sessions list
    setSessions((prev) => prev.filter((s) => s.id !== session.id));
    
    // Send notification
    try {
      await invoke("send_notification", { 
        title: "Session Archived", 
        body: `"${session.title}" has been archived` 
      });
    } catch {}
  }, [archivedSessions]);

  const bulkArchiveSessions = useCallback(async (sessionsToArchive: Session[]): Promise<void> => {
    const newArchived = [...archivedSessions, ...sessionsToArchive.map(s => ({ ...s, archived: true }))];
    setArchivedSessions(newArchived);
    localStorage.setItem("archivedSessions", JSON.stringify(newArchived));
    
    // Remove from current sessions list
    setSessions((prev) => prev.filter((s) => !sessionsToArchive.some(archived => archived.id === s.id)));
    
    // Send notification
    try {
      await invoke("send_notification", { 
        title: "Sessions Archived", 
        body: `${sessionsToArchive.length} session(s) have been archived` 
      });
    } catch {}
  }, [archivedSessions]);

  const unarchiveSession = useCallback(async (session: Session): Promise<void> => {
    const newArchived = archivedSessions.filter((s) => s.id !== session.id);
    setArchivedSessions(newArchived);
    localStorage.setItem("archivedSessions", JSON.stringify(newArchived));
    
    // Remove archived flag and add back to sessions list
    const { archived: _, ...restored } = session;
    setSessions((prev) => [restored, ...prev]);
    
    try {
      await invoke("send_notification", { 
        title: "Session Restored", 
        body: `"${session.title}" has been restored` 
      });
    } catch {}
  }, [archivedSessions]);
  
  const deleteArchivedSession = useCallback(async (session: Session): Promise<void> => {
    const newArchived = archivedSessions.filter((s) => s.id !== session.id);
    setArchivedSessions(newArchived);
    localStorage.setItem("archivedSessions", JSON.stringify(newArchived));
  }, [archivedSessions]);

  const bulkDeleteArchivedSessions = useCallback(async (sessionsToDelete: Session[]): Promise<void> => {
    const newArchived = archivedSessions.filter(s => !sessionsToDelete.some(toDelete => toDelete.id === s.id));
    setArchivedSessions(newArchived);
    localStorage.setItem("archivedSessions", JSON.stringify(newArchived));
    
    try {
      await invoke("send_notification", { 
        title: "Sessions Deleted", 
        body: `${sessionsToDelete.length} session(s) have been deleted` 
      });
    } catch {}
  }, [archivedSessions]);

  const toggleShowArchived = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

  const bulkDeleteSessions = useCallback(async (sessionsToDelete: Session[]): Promise<void> => {
    if (!selectedInstance) return;
    
    // Delete all sessions in parallel
    await Promise.all(
      sessionsToDelete.map(session => deleteSession(selectedInstance, session.id))
    );
    
    // Remove from sessions list
    setSessions((prev) => prev.filter((s) => !sessionsToDelete.some(toDelete => toDelete.id === s.id)));
    
    // Clear selection if selected session was deleted
    if (selectedSession && sessionsToDelete.some(s => s.id === selectedSession.id)) {
      setSelectedSession(null);
      setSessionDetails(null);
      setDiffs([]);
      setSessionStatus("idle");
    }
    
    // Send notification
    try {
      await invoke("send_notification", { 
        title: "Sessions Deleted", 
        body: `${sessionsToDelete.length} session(s) have been deleted` 
      });
    } catch {}
  }, [selectedInstance, selectedSession]);

  const sendNotification = useCallback(async (title: string, body: string): Promise<void> => {
    try {
      await invoke("send_notification", { title, body });
    } catch {}
  }, []);

  // Update tray icon based on status
  useEffect(() => {
    const updateBadge = async () => {
      let badge: string | null = null;
      
      if (sessionStatus === "busy") {
        badge = "•";
      } else if (diffs.length > 0) {
        badge = diffs.length.toString();
      }
      
      try {
        await invoke("update_tray_icon", { badge });
      } catch {}
    };
    
    updateBadge();
  }, [sessionStatus, diffs]);

  // Send notification when session completes (transitions from busy to idle)
  useEffect(() => {
    // Only notify when transitioning FROM busy TO idle with diffs
    if (
      prevStatusRef.current === "busy" && 
      sessionStatus === "idle" && 
      selectedSession && 
      diffs.length > 0
    ) {
      invoke("send_notification", {
        title: "Task Completed",
        body: `${selectedSession.title} has ${diffs.length} file${diffs.length > 1 ? "s" : ""} changed`,
      }).catch(() => {});
    }
    prevStatusRef.current = sessionStatus;
  }, [sessionStatus, diffs, selectedSession]);

  // Show permission popup when a permission request comes in
  useEffect(() => {
    if (!permissionRequest || !selectedInstance) return;

    // Find the session title for the permission request
    const session = sessions.find((s) => s.id === permissionRequest.sessionID);
    const sessionTitle = session?.title || "Unknown session";

    // Show the permission popup window
    invoke("show_permission_popup", {
      data: {
        request: permissionRequest,
        sessionTitle,
        instanceUrl: selectedInstance.url,
      },
    }).catch((err) => {
      console.error("Failed to show permission popup:", err);
    });
  }, [permissionRequest, selectedInstance, sessions]);

  return {
    instances,
    selectedInstance,
    sessions,
    selectedSession,
    sessionDetails,
    diffs,
    todos,
    loading,
    error,
    permissionRequest,
    sessionStatus,
    config,
    mcpServers,
    providers,
    showArchived,
    archivedSessions,
    selectInstance,
    selectSession,
    clearSession,
    clearInstance,
    refresh,
    sendChatMessage,
    abort,
    respondToPermission,
    createNewSession,
    removeSession,
    refreshTodos,
    archiveSession,
    bulkArchiveSessions,
    unarchiveSession,
    deleteArchivedSession,
    bulkDeleteArchivedSessions,
    bulkDeleteSessions,
    toggleShowArchived,
    sendNotification,
  };
}
