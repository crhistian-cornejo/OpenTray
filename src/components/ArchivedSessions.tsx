import { useMemo, useState, useRef } from "react";
import type { Session } from "../lib/types";
import { formatTime } from "../lib/utils";

interface ArchivedSessionsProps {
  sessions: Session[];
  onSelectSession?: (session: Session) => void;
  onUnarchive: (session: Session) => void;
  onDelete: (session: Session) => void;
  onBulkDelete?: (sessions: Session[]) => void;
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

export function ArchivedSessions({ sessions, onSelectSession, onUnarchive, onDelete }: ArchivedSessionsProps) {
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

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    show: false,
    x: 0,
    y: 0,
    session: null,
  });
  
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: MouseEvent, session: Session) => {
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

  if (sessions.length === 0) {
    return (
      <div className="empty">
        <p>No archived sessions</p>
      </div>
    );
  }

  return (
    <div className="list fade-in">
      {groups.map((group) => (
        <div key={group.directory} className="session-group">
          <div className="session-group-header archived">
            <div className="session-group-info">
              <span className="session-group-name">{group.projectName}</span>
              <span className="session-group-count">{group.sessions.length}</span>
            </div>
          </div>
          <div className="session-group-sessions">
            {group.sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                className="list-item session-item archived"
                onClick={() => onSelectSession?.(session)}
                onContextMenu={(e) => handleContextMenu(e.nativeEvent, session)}
              >
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
            ))}
          </div>
        </div>
      ))}
      
      {/* Context Menu */}
      {contextMenu.show && contextMenu.session && (
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
