import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { type as getOsType } from "@tauri-apps/plugin-os";
import {
  Header,
  InstanceList,
  SessionList,
  ChatView,
  DiffView,
  PermissionModal,
  SettingsView,
  TodoList,
  ArchivedSessions,
  UpdateBanner,
} from "./components";
import { useOpenCode, useTheme, useUpdater, useSettings } from "./hooks";
import type { View } from "./lib/types";
import { getDirectoryName } from "./lib/utils";


function App() {
  const [initialized, setInitialized] = useState(false);
  const [view, setView] = useState<View>("instances");
  const [osType, setOsType] = useState<string>("");
  const [showTodoList, setShowTodoList] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const { theme, setTheme } = useTheme();
  const {
    updateAvailable,
    updateInfo,
    downloading,
    progress,
    error: updateError,
    installUpdate,
    dismissUpdate,
  } = useUpdater();

  const { settings: appSettings } = useSettings();

  const {
    instances,
    selectedInstance,
    sessions,
    selectedSession,
    sessionDetails,
    diffs,
    loading,
    permissionRequest,
    sessionStatus,
    config,
    mcpServers,
    providers,
    archivedSessions,
    selectInstance,
    selectSession,
    clearSession,
    clearInstance,
    refresh,
    sendChatMessage,
    abort,
    changeModel,
    respondToPermission,
    createNewSession,
    removeSession,
    todos,
    archiveSession,
    bulkArchiveSessions,
    unarchiveSession,
    deleteArchivedSession,
    bulkDeleteArchivedSessions,
    bulkDeleteSessions,
  } = useOpenCode();

  // Initialize the panel
  useEffect(() => {
    if (!initialized) {
      invoke("init").then(async () => {
        setInitialized(true);
        try {
          const type = await getOsType();
          setOsType(type);
        } catch (e) {
          console.error("Failed to get OS type", e);
        }
      });
    }
  }, [initialized]);

  // Auto-navigate when instance is selected
  useEffect(() => {
    if (selectedInstance && view === "instances") {
      setView("sessions");
    }
  }, [selectedInstance, view]);

  // Listen for tray menu events
  useEffect(() => {
    const unlistenNewSession = listen("tray-new-session", async () => {
      if (selectedInstance) {
        const session = await createNewSession();
        if (session) {
          selectSession(session);
          setView("chat");
        }
      }
    });

    const unlistenRefresh = listen("tray-refresh", () => {
      refresh();
    });

    const unlistenSettings = listen("tray-settings", () => {
      setView("settings");
    });

    return () => {
      unlistenNewSession.then((fn) => fn());
      unlistenRefresh.then((fn) => fn());
      unlistenSettings.then((fn) => fn());
    };
  }, [selectedInstance, refresh, createNewSession, selectSession]);

  const handleInstanceSelect = (instance: typeof instances[0]) => {
    selectInstance(instance);
    setView("sessions");
  };

  const handleSessionSelect = (session: typeof sessions[0]) => {
    selectSession(session);
    setView("chat");
  };

  const handleNewSession = async () => {
    const session = await createNewSession();
    if (session) {
      selectSession(session);
      setView("chat");
    }
  };

  const handleBack = () => {
    if (view === "chat" || view === "diffs") {
      clearSession();
      setView("sessions");
    } else if (view === "sessions") {
      clearInstance();
      setView("instances");
    } else if (view === "archived") {
      setView("sessions");
    } else if (view === "settings") {
      setView("instances");
    }
  };

  const handleUnarchive = async (session: typeof sessions[0]) => {
    await unarchiveSession(session);
  };

  const handleDeleteArchived = async (session: typeof sessions[0]) => {
    await deleteArchivedSession(session);
  };

  const handleBulkDeleteArchived = async (sessionsToDelete: typeof sessions[0][]) => {
    await bulkDeleteArchivedSessions(sessionsToDelete);
  };

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
  };

  // Compute header props
  const getTitle = () => {
    switch (view) {
      case "instances": return "OpenTray";
      case "sessions": return selectedInstance ? getDirectoryName(selectedInstance.directory) : "Sessions";
      case "chat": return selectedSession?.title || "Chat";
      case "diffs": return "Changes";
      case "archived": return "Archived Sessions";
      case "settings": return "Settings";
    }
  };

  return (
    <div className={`app ${initialized ? 'visible' : ''} ${osType === 'windows' ? 'is-windows' : ''} ${appSettings.compact_mode ? 'compact-mode' : ''}`}>
      {updateAvailable && updateInfo && (
        <UpdateBanner
          updateInfo={updateInfo}
          downloading={downloading}
          progress={progress}
          error={updateError}
          onInstall={installUpdate}
          onDismiss={dismissUpdate}
        />
      )}
      <Header
        title={getTitle()}
        showBack={view !== "instances"}
        showRefresh={view !== "settings"}
        showSettings={view === "instances"}
        showDiffs={view === "chat" && diffs.length > 0}
        diffsCount={diffs.length}
        showChat={view === "diffs"}
        showTodos={view === "chat"}
        todosCount={todos.length}
        showArchived={view === "sessions"}
        archivedCount={archivedSessions.length}
        showSelect={view === "sessions" || view === "archived"}
        showNewSession={view === "sessions"}
        onBack={handleBack}
        onRefresh={refresh}
        onSettings={() => setView("settings")}
        onDiffs={() => setView("diffs")}
        onChat={() => setView("chat")}
        onTodos={() => setShowTodoList(true)}
        onArchived={() => setView("archived")}
        onSelect={toggleSelectionMode}
        onNewSession={handleNewSession}
      />

      <main className="content">
        {view === "instances" && (
          <InstanceList
            instances={instances}
            loading={loading}
            onSelect={handleInstanceSelect}
          />
        )}

        {view === "sessions" && (
          <SessionList
            sessions={sessions}
            activeDirectory={selectedInstance?.directory}
            onSelect={handleSessionSelect}
            onDeleteSession={removeSession}
            onArchiveSession={archiveSession}
            onBulkArchive={bulkArchiveSessions}
            onBulkDelete={bulkDeleteSessions}
            selectionMode={selectionMode}
            onExitSelectionMode={() => setSelectionMode(false)}
          />
        )}

        {view === "chat" && sessionDetails && (
          <ChatView
            messages={sessionDetails.messages}
            status={sessionStatus}
            providers={providers}
            config={config}
            projectDirectory={selectedInstance?.directory}
            onSendMessage={sendChatMessage}
            onAbort={abort}
            onModelChange={changeModel}
          />
        )}

        {view === "diffs" && (
          <DiffView diffs={diffs} />
        )}

        {view === "settings" && (
          <SettingsView
            theme={theme}
            onThemeChange={setTheme}
            instance={selectedInstance}
            config={config}
            mcpServers={mcpServers}
            providers={providers}
          />
        )}

        {view === "archived" && (
          <ArchivedSessions
            sessions={archivedSessions}
            onUnarchive={handleUnarchive}
            onDelete={handleDeleteArchived}
            onBulkDelete={handleBulkDeleteArchived}
            selectionMode={selectionMode}
            onExitSelectionMode={() => setSelectionMode(false)}
          />
        )}
      </main>

      {permissionRequest && (
        <PermissionModal
          request={permissionRequest}
          onReply={respondToPermission}
        />
      )}

      {showTodoList && (
        <TodoList
          todos={todos}
          onClose={() => setShowTodoList(false)}
        />
      )}
    </div>
  );
}

export default App;
