interface HeaderProps {
  title: string;
  showBack: boolean;
  showRefresh: boolean;
  showSettings: boolean;
  showDiffs: boolean;
  diffsCount: number;
  showChat: boolean;
  showTodos?: boolean;
  todosCount?: number;
  showArchived?: boolean;
  archivedCount?: number;
  showSelect?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onDiffs: () => void;
  onChat: () => void;
  onTodos?: () => void;
  onArchived?: () => void;
  onSelect?: () => void;
}

export function Header({
  title,
  showBack,
  showRefresh,
  showSettings,
  showDiffs,
  diffsCount,
  showChat,
  showTodos = false,
  todosCount = 0,
  showArchived = false,
  archivedCount = 0,
  showSelect = false,
  onBack,
  onRefresh,
  onSettings,
  onDiffs,
  onChat,
  onTodos,
  onArchived,
  onSelect,
}: HeaderProps) {
  return (
    <header className="header">
      {showBack && (
        <button type="button" className="header-btn" onClick={onBack} aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <h1 className="header-title">{title}</h1>
      <div className="header-actions">
        {showSelect && (
          <button type="button" className="header-btn" onClick={onSelect} aria-label="Select sessions">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 7h2v1H4v-1zM6 7h4v1H6v-1z" fill="currentColor" stroke="none"/>
            </svg>
            Select
          </button>
        )}
        {showTodos && todosCount > 0 && (
          <button type="button" className="header-btn" onClick={onTodos} aria-label={`View ${todosCount} tasks`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4h10M3 8h10M3 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M12 10l1.5 1.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="badge">{todosCount}</span>
          </button>
        )}
        {showRefresh && (
          <button type="button" className="header-btn" onClick={onRefresh} aria-label="Refresh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.5 8C13.5 11.038 11.038 13.5 8 13.5C4.962 13.5 2.5 11.038 2.5 8C2.5 4.962 4.962 2.5 8 2.5C10.194 2.5 12.084 3.834 12.934 5.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10.5 5.75H13.25V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        {showSettings && (
          <button type="button" className="header-btn" onClick={onSettings} aria-label="Settings">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 2V4M8 12V14M14 8H12M4 8H2M12.24 3.76L10.83 5.17M5.17 10.83L3.76 12.24M12.24 12.24L10.83 10.83M5.17 5.17L3.76 3.76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )}
        {showDiffs && (
          <button type="button" className="header-btn" onClick={onDiffs} aria-label={`View ${diffsCount} changes`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3H13V13H3V3Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 6V10M8 8H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="badge">{diffsCount}</span>
          </button>
        )}
        {showArchived && archivedCount > 0 && (
          <button type="button" className="header-btn" onClick={onArchived} aria-label={`View ${archivedCount} archived sessions`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 4h6a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3 4h10" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="badge">{archivedCount}</span>
          </button>
        )}
        {showChat && (
          <button type="button" className="header-btn" onClick={onChat} aria-label="Back to chat">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M14 10C14 10.5304 13.7893 11.0391 13.4142 11.4142C13.0391 11.7893 12.5304 12 12 12H6L2 14V4C2 3.46957 2.21071 2.96086 2.58579 2.58579C2.96086 2.21071 3.46957 2 4 2H12C12.5304 2 13.0391 2.21071 13.4142 2.58579C13.7893 2.96086 14 3.46957 14 4V10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
