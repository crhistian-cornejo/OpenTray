import { useMemo, useState, useRef, useEffect } from "react";
import type { Session } from "../lib/types";
import { formatTime } from "../lib/utils";

interface SessionListProps {
  sessions: Session[];
  activeDirectory?: string;
  onSelect: (session: Session) => void;
  onNewSession?: () => void;
  onDeleteSession?: (session: Session) => void;
  onArchiveSession?: (session: Session) => void;
  onBulkArchive?: (sessions: Session[]) => void;
  onBulkDelete?: (sessions: Session[]) => void;
  selectionMode?: boolean;
  onEnterSelectionMode?: () => void;
  showArchived?: boolean;
}

interface SessionGroup {
  directory: string;
  projectName: string;
  sessions: Session[];
  isActive: boolean;
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  session: Session | null;
}

function getProjectName(directory: string): string {
  const parts = directory.split("/");
  return parts[parts.length - 1] || directory;
}

function groupSessionsByDirectory(sessions: Session[], activeDirectory?: string): SessionGroup[] {
  const groups: Record<string, Session[]> = {};
  
  for (const session of sessions) {
    const dir = session.directory || "Unknown";
    if (!groups[dir]) {
      groups[dir] = [];
    }
    groups[dir].push(session);
  }
  
  return Object.entries(groups)
    .map(([directory, sessions]) => ({
      directory,
      projectName: getProjectName(directory),
      sessions: sessions.sort((a, b) => (b.time?.updated ?? 0) - (a.time?.updated ?? 0)),
      isActive: directory === activeDirectory,
    }))
    .sort((a, b) => {
      // Active project first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      // Then by most recent session
      const aTime = a.sessions[0]?.time?.updated ?? 0;
      const bTime = b.sessions[0]?.time?.updated ?? 0;
      return bTime - aTime;
    });
}

export function SessionList({ sessions, activeDirectory, onSelect, onNewSession, onDeleteSession, onArchiveSession, onBulkArchive, onBulkDelete, selectionMode = false, onEnterSelectionMode }: SessionListProps) {
  const groups = useMemo(() => groupSessionsByDirectory(sessions, activeDirectory), [sessions, activeDirectory]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (activeDirectory) {
      initial.add(activeDirectory);
    } else if (groups.length > 0) {
      initial.add(groups[0].directory);
    }
    return initial;
  });
  
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    session: null,
  });
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(prev => ({ ...prev, show: false }));
      }
    };
    
    if (contextMenu.show) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [contextMenu.show]);

  // Sync selectionMode with prop
  useEffect(() => {
    if (selectionMode) {
      setSelectedSessions(new Set());
    }
  }, [selectionMode]);

  const toggleGroup = (directory: string) => {
    if (selectionMode) return;
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(directory)) {
        next.delete(directory);
      } else {
        next.add(directory);
      }
      return next;
    });
  };

  const handleContextMenu = (e: MouseEvent, session: Session) => {
    if (selectionMode) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      session,
    });
  };

  const handleCopyId = () => {
    if (contextMenu.session) {
      navigator.clipboard.writeText(contextMenu.session.id);
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const handleCopyTitle = () => {
    if (contextMenu.session) {
      navigator.clipboard.writeText(contextMenu.session.title || "Untitled");
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const handleDelete = () => {
    if (contextMenu.session && onDeleteSession) {
      onDeleteSession(contextMenu.session);
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const handleArchive = () => {
    if (contextMenu.session && onArchiveSession) {
      onArchiveSession(contextMenu.session);
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const handleBulkArchive = () => {
    if (selectedSessions.size > 0 && onBulkArchive) {
      const sessionsToArchive = sessions.filter(s => selectedSessions.has(s.id));
      onBulkArchive(sessionsToArchive);
    }
  };

  const handleBulkDelete = () => {
    if (selectedSessions.size > 0 && onBulkDelete) {
      const sessionsToDelete = sessions.filter(s => selectedSessions.has(s.id));
      onBulkDelete(sessionsToDelete);
    }
  };

  const toggleSelection = (session: Session) => {
    if (!selectionMode) return;
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(session.id)) {
        next.delete(session.id);
      } else {
        next.add(session.id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!selectionMode) return;
    const allSelected = selectedSessions.size === sessions.length;
    if (allSelected) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)));
    }
  };

  const hasSelection = selectedSessions.size > 0;
  const allSelected = sessions.length > 0 && selectedSessions.size === sessions.length;

  return (
    <div className="list fade-in">
      {/* Selection Header */}
      {selectionMode && (
        <div className="selection-header">
          <button
            type="button"
            className="selection-back-btn"
            onClick={onEnterSelectionMode}
            aria-label="Exit selection mode"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="selection-count">
            {selectedSessions.size} selected
          </span>
          <button
            type="button"
            className="selection-btn"
            onClick={toggleSelectAll}
            aria-label={allSelected ? "Deselect all" : "Select all"}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <div className="selection-divider" />
          {onBulkArchive && (
            <button
              type="button"
              className="selection-btn"
              onClick={handleBulkArchive}
              disabled={!hasSelection}
              aria-label="Archive selected"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M6 4V2a1 1 0 011-1h2a1 1 0 011 1v2M8 9v2M5 7l2 6M10 7l-2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Archive ({selectedSessions.size})
            </button>
          )}
          {onBulkDelete && (
            <button
              type="button"
              className="selection-btn danger"
              onClick={handleBulkDelete}
              disabled={!hasSelection}
              aria-label="Delete selected"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 7v5M8 7v5M11 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M4 4l.5 9a1 1 0 001 1h5a1 1 0 001-1l.5-9" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Delete ({selectedSessions.size})
            </button>
          )}
        </div>
      )}

      {onNewSession && (
        <button
          type="button"
          className="list-item new-session-btn"
          onClick={onNewSession}
        >
          <div className="list-item-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="list-item-content">
            <span className="list-item-title">New Session</span>
            <span className="list-item-subtitle">Start a new conversation</span>
          </div>
        </button>
      )}
      {sessions.length === 0 && !onNewSession && (
        <div className="empty">
          <p>No sessions yet</p>
        </div>
      )}
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.directory);
        const totalAdditions = group.sessions.reduce((sum, s) => sum + (s.summary?.additions ?? 0), 0);
        const totalDeletions = group.sessions.reduce((sum, s) => sum + (s.summary?.deletions ?? 0), 0);
        
        return (
          <div key={group.directory} className="session-group">
            <button
              type="button"
              className={`session-group-header ${group.isActive ? "active" : ""}`}
              onClick={() => toggleGroup(group.directory)}
            >
              <span className={`session-group-icon ${isExpanded ? "expanded" : ""}`}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div className="session-group-info">
                <span className="session-group-name">{group.projectName}</span>
                <span className="session-group-count">{group.sessions.length}</span>
              </div>
              {(totalAdditions > 0 || totalDeletions > 0) && (
                <div className="session-group-stats">
                  <span className="diff-add">+{totalAdditions}</span>
                  <span className="diff-del">-{totalDeletions}</span>
                </div>
              )}
            </button>
            {isExpanded && (
              <div className="session-group-sessions">
                {group.sessions.map((session) => {
                  const isSelected = selectedSessions.has(session.id);
                  return (
                    <button
                      type="button"
                      key={session.id}
                      className={`list-item session-item ${isSelected ? "selected" : ""}`}
                      onClick={(e) => {
                        if (selectionMode) {
                          e.stopPropagation();
                          toggleSelection(session);
                        } else {
                          onSelect(session);
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e.nativeEvent, session)}
                    >
                      {selectionMode && (
                        <div className="session-checkbox">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            {isSelected ? (
                              <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/>
                            ) : (
                              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                            )}
                            {isSelected && (
                              <path d="M4 8l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            )}
                          </svg>
                        </div>
                      )}
                      <div className="list-item-content">
                        <span className="list-item-title">{session.title || "Untitled"}</span>
                        <span className="list-item-subtitle">
                          {session.summary && (session.summary.additions > 0 || session.summary.deletions > 0) ? (
                            <>
                              <span className="diff-add">+{session.summary.additions}</span>
                              <span className="diff-del">-{session.summary.deletions}</span>
                              {session.summary.files > 0 && (
                                <span className="diff-files">{session.summary.files} files</span>
                              )}
                            </>
                          ) : null}
                        </span>
                      </div>
                      <span className="list-item-meta">{formatTime(session.time?.updated ?? session.time?.created ?? 0)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      
      {/* Context Menu */}
      {contextMenu.show && contextMenu.session && !selectionMode && (
        <div 
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button type="button" className="context-menu-item" onClick={handleCopyTitle}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 12V3a1 1 0 011-1h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Copy Title
          </button>
          <button type="button" className="context-menu-item" onClick={handleCopyId}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="7" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Copy ID
          </button>
          <button 
            type="button" 
            className="context-menu-item" 
            onClick={handleArchive}
            disabled={!onArchiveSession}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4h12M6 4V2a1 1 0 011-1h2a1 1 0 011 1v2M8 9v2M5 7l2 6M10 7l-2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Archive Session
          </button>
          <div className="context-menu-divider" />
          <button 
            type="button" 
            className="context-menu-item danger" 
            onClick={handleDelete}
            disabled={!onDeleteSession}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 7v5M8 7v5M11 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 4l.5 9a1 1 0 001 1h5a1 1 0 001-1l.5-9" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Delete Session
          </button>
        </div>
      )}
    </div>
  );
}
