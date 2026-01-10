import type { OpenCodeInstance } from "../lib/types";
import { getDirectoryName } from "../lib/utils";

interface InstanceListProps {
  instances: OpenCodeInstance[];
  loading: boolean;
  onSelect: (instance: OpenCodeInstance) => void;
}

export function InstanceList({ instances, loading, onSelect }: InstanceListProps) {
  return (
    <div className="list fade-in">
      {loading && (
        <div className="loading">
          <div className="spinner spin" />
          <span>Scanning for OpenCode...</span>
        </div>
      )}
      {!loading && instances.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 11V17M16 21H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p>No OpenCode instances running</p>
          <span className="empty-hint">Start OpenCode in a terminal to connect</span>
        </div>
      )}
      {instances.map((instance) => (
        <button
          type="button"
          key={instance.url}
          className="list-item"
          onClick={() => onSelect(instance)}
        >
          <div className="list-item-icon">
            <div className={`status-dot ${instance.connected ? "connected" : ""}`} />
          </div>
          <div className="list-item-content">
            <span className="list-item-title">{getDirectoryName(instance.directory)}</span>
            <span className="list-item-subtitle">{instance.directory}</span>
          </div>
          <span className="list-item-meta">:{instance.port}</span>
        </button>
      ))}
    </div>
  );
}
