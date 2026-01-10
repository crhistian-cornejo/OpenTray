import type { PermissionRequest } from "../lib/types";

interface PermissionModalProps {
  request: PermissionRequest;
  onReply: (reply: "once" | "always" | "reject") => void;
}

export function PermissionModal({ request, onReply }: PermissionModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal fade-in">
        <div className="modal-header">
          <h2>Permission Required</h2>
        </div>
        <div className="modal-content">
          <p className="permission-type">{request.permission}</p>
          <div className="permission-patterns">
            {request.patterns.map((pattern) => (
              <code key={pattern}>{pattern}</code>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-deny" onClick={() => onReply("reject")}>
            Deny
          </button>
          <button type="button" className="btn btn-once" onClick={() => onReply("once")}>
            Allow Once
          </button>
          <button type="button" className="btn btn-always" onClick={() => onReply("always")}>
            Always Allow
          </button>
        </div>
      </div>
    </div>
  );
}
