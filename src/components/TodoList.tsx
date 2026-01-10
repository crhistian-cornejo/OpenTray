import type { TodoItem } from "../lib/types";

interface TodoListProps {
  todos: TodoItem[];
  onClose: () => void;
}

function getStatusIcon(status: TodoItem["status"]): string {
  switch (status) {
    case "completed":
      return "✓";
    case "in_progress":
      return "◐";
    case "cancelled":
      return "✕";
    default:
      return "○";
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
          <h3>Task List</h3>
          <button type="button" className="todo-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="todo-content">
          {todos.length === 0 ? (
            <div className="todo-empty">
              <span>No tasks</span>
              <p>The agent hasn't created any tasks yet.</p>
            </div>
          ) : (
            <>
              {/* In Progress */}
              {inProgress.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-title">In Progress</div>
                  {inProgress.map((todo) => (
                    <div key={todo.id} className={`todo-item status-in_progress ${getPriorityClass(todo.priority)}`}>
                      <span className="todo-status">{getStatusIcon(todo.status)}</span>
                      <span className="todo-content-text">{todo.content}</span>
                      <span className="todo-priority">{todo.priority}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending */}
              {pending.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-title">Pending ({pending.length})</div>
                  {pending.map((todo) => (
                    <div key={todo.id} className={`todo-item status-pending ${getPriorityClass(todo.priority)}`}>
                      <span className="todo-status">{getStatusIcon(todo.status)}</span>
                      <span className="todo-content-text">{todo.content}</span>
                      <span className="todo-priority">{todo.priority}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Completed */}
              {completed.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-title">Completed ({completed.length})</div>
                  {completed.map((todo) => (
                    <div key={todo.id} className={`todo-item status-completed ${getPriorityClass(todo.priority)}`}>
                      <span className="todo-status">{getStatusIcon(todo.status)}</span>
                      <span className="todo-content-text">{todo.content}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cancelled */}
              {cancelled.length > 0 && (
                <div className="todo-section">
                  <div className="todo-section-title">Cancelled ({cancelled.length})</div>
                  {cancelled.map((todo) => (
                    <div key={todo.id} className={`todo-item status-cancelled ${getPriorityClass(todo.priority)}`}>
                      <span className="todo-status">{getStatusIcon(todo.status)}</span>
                      <span className="todo-content-text">{todo.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="todo-footer">
          <span className="todo-stats">
            {completed.length}/{todos.length} completed
          </span>
        </div>
      </div>
    </div>
  );
}
