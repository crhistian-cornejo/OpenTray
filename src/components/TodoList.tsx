import type { TodoItem } from "../lib/types";

interface TodoListProps {
  todos: TodoItem[];
  onClose: () => void;
}

function StatusIcon({ status }: { status: TodoItem["status"] }) {
  switch (status) {
    case "completed":
      return (
        <svg className="status-icon completed" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="currentColor" />
          <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    case "in_progress":
      return (
        <div className="status-icon in-progress">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="20 20" />
          </svg>
        </div>
      );
    case "cancelled":
      return (
        <svg className="status-icon cancelled" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      );
    default:
      return (
        <svg className="status-icon pending" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

function getPriorityClass(priority: TodoItem["priority"]): string {
  switch (priority) {
    case "high":
      return "priority-high";
    case "medium":
      return "priority-medium";
    default:
      return "priority-low";
  }
}

export function TodoList({ todos, onClose }: TodoListProps) {
  const pending = todos.filter(t => t.status === "pending");
  const inProgress = todos.filter(t => t.status === "in_progress");
  const completed = todos.filter(t => t.status === "completed");
  const cancelled = todos.filter(t => t.status === "cancelled");
  
  const completionPercent = todos.length > 0 
    ? Math.round((completed.length / todos.length) * 100) 
    : 0;

  return (
    <div 
      className="todo-overlay" 
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Task list"
      tabIndex={-1}
    >
      <div 
        className="todo-panel" 
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="todo-header">
          <div className="todo-header-left">
            <svg className="todo-header-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Tasks</h3>
          </div>
          <button type="button" className="todo-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {todos.length > 0 && (
          <div className="todo-progress">
            <div className="todo-progress-bar">
              <div 
                className="todo-progress-fill" 
                style={{ width: `${completionPercent}%` }}
              />
            </div>
            <span className="todo-progress-text">{completionPercent}% complete</span>
          </div>
        )}

        <div className="todo-content">
          {todos.length === 0 ? (
            <div className="todo-empty">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>No tasks</span>
              <p>The agent hasn't created any tasks yet.</p>
            </div>
          ) : (
            <>
              {/* In Progress */}
              {inProgress.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-header in-progress">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="15 15"/>
                    </svg>
                    <span className="todo-section-title">In Progress</span>
                    <span className="todo-section-count">{inProgress.length}</span>
                  </div>
                  {inProgress.map((todo) => (
                    <div key={todo.id} className={`todo-item status-in_progress ${getPriorityClass(todo.priority)}`}>
                      <StatusIcon status={todo.status} />
                      <div className="todo-item-content">
                        <span className="todo-content-text">{todo.content}</span>
                        <span className={`todo-priority ${todo.priority}`}>{todo.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending */}
              {pending.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-header pending">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span className="todo-section-title">Pending</span>
                    <span className="todo-section-count">{pending.length}</span>
                  </div>
                  {pending.map((todo) => (
                    <div key={todo.id} className={`todo-item status-pending ${getPriorityClass(todo.priority)}`}>
                      <StatusIcon status={todo.status} />
                      <div className="todo-item-content">
                        <span className="todo-content-text">{todo.content}</span>
                        <span className={`todo-priority ${todo.priority}`}>{todo.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed */}
              {completed.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-header completed">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="5" fill="currentColor"/>
                      <path d="M4 6l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="todo-section-title">Completed</span>
                    <span className="todo-section-count">{completed.length}</span>
                  </div>
                  {completed.map((todo) => (
                    <div key={todo.id} className={`todo-item status-completed ${getPriorityClass(todo.priority)}`}>
                      <StatusIcon status={todo.status} />
                      <div className="todo-item-content">
                        <span className="todo-content-text">{todo.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Cancelled */}
              {cancelled.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-header cancelled">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="todo-section-title">Cancelled</span>
                    <span className="todo-section-count">{cancelled.length}</span>
                  </div>
                  {cancelled.map((todo) => (
                    <div key={todo.id} className={`todo-item status-cancelled ${getPriorityClass(todo.priority)}`}>
                      <StatusIcon status={todo.status} />
                      <div className="todo-item-content">
                        <span className="todo-content-text">{todo.content}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="todo-footer">
          <span className="todo-stats">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" fill="currentColor"/>
              <path d="M4 6l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {completed.length} of {todos.length} completed
          </span>
        </div>
      </div>
    </div>
  );
}
