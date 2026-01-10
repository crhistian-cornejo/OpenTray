import { useMemo, useState, useRef, useEffect } from "react";
import type { Session } from "../lib/types";
import { formatTime } from "../lib/utils";

interface ArchivedSessionsProps {
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
  onUnarchive: (session: Session) => void;
  onDelete: (session: Session) => void;
  onBulkDelete?: (sessions: Session[]) => void;
  selectionMode?: boolean;
  onExitSelectionMode?: () => void;
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

export function ArchivedSessions({ sessions, onSelectSession, onUnarchive, onDelete, onBulkDelete, selectionMode = false, onExitSelectionMode }: ArchivedSessionsProps) {
  const groups = useMemo(() => {
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
      }))
      .sort((a, b) => {
        const aTime = a.sessions[0]?.time?.updated ?? 0;
        const bTime = b.sessions[0]?.time?.updated ?? 0;
        return bTime - aTime;
      });
  }, [sessions]);

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

  // Adjust context menu position to stay within viewport
  useEffect(() => {
    if (contextMenu.show && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = contextMenu.x;
      let newY = contextMenu.y;
      
      // Adjust horizontal position if menu goes off right edge
      if (rect.right > viewportWidth) {
        newX = viewportWidth - rect.width - 8;
      }
      if (newX < 8) {
        newX = 8;
      }
      
      // Adjust vertical position if menu goes off bottom edge
      if (rect.bottom > viewportHeight) {
        newY = viewportHeight - rect.height - 8;
      }
      if (newY < 8) {
        newY = 8;
      }
      
      // Apply adjusted position
      if (newX !== contextMenu.x || newY !== contextMenu.y) {
        menu.style.left = `${newX}px`;
        menu.style.top = `${newY}px`;
      }
    }
  }, [contextMenu.show, contextMenu.x, contextMenu.y]);

  // Sync selectionMode with prop
  useEffect(() => {
    if (selectionMode) {
      setSelectedSessions(new Set());
    }
  }, [selectionMode]);

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

  const handleUnarchive = () => {
    if (contextMenu.session) {
      onUnarchive(contextMenu.session);
    }
    setContextMenu(prev => ({ ...prev, show: false }));
  };

  const handleDelete = () => {
    if (contextMenu.session) {
      onDelete(contextMenu.session);
    }
    setContextMenu(prev => ({ ...prev, show: false }));
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

  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p>No archived sessions</p>
      </div>
    );
  }

  return (
    <div className="list fade-in">
      {/* Selection Header */}
      {selectionMode && (
        <div className="selection-header">
          <button
            type="button"
            className="selection-back-btn"
            onClick={onExitSelectionMode}
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

      {groups.map((group) => (
        <div key={group.directory} className="session-group">
          <div className="session-group-header archived">
            <div className="session-group-info">
              <span className="session-group-name">{group.projectName}</span>
              <span className="session-group-count">{group.sessions.length}</span>
            </div>
          </div>
          <div className="session-group-sessions">
            {group.sessions.map((session) => {
              const isSelected = selectedSessions.has(session.id);
              return (
                <button
                  type="button"
                  key={session.id}
                  className={`list-item session-item archived ${isSelected ? "selected" : ""}`}
                  onClick={(e) => {
                    if (selectionMode) {
                      e.stopPropagation();
                      toggleSelection(session);
                    } else {
                      onSelectSession?.(session);
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
        </div>
      ))}
      
      {/* Context Menu */}
      {contextMenu.show && contextMenu.session && !selectionMode && (
        <div 
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          ref={menuRef}
        >
          <button type="button" className="context-menu-item" onClick={handleUnarchive}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 4h12M6 4V2a1 1 0 011-1h2a1 1 0 011 1v2M4 4v9a1 1 0 001 1h6a1 1 0 001-1V4M5 7v6M8 7v6M11 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Unarchive
          </button>
          <div className="context-menu-divider" />
          <button 
            type="button" 
            className="context-menu-item danger" 
            onClick={handleDelete}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 7v5M8 7v5M11 7v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M4 4l.5 9a1 1 0 001 1h5a1 1 0 001-1l.5-9" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
