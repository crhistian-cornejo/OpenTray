import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PermissionRequest } from "../lib/types";

interface PermissionData {
  request: PermissionRequest;
  sessionTitle: string;
  instanceUrl: string;
}

export function PermissionPopup() {
  const [data, setData] = useState<PermissionData | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    // Listen for permission request data from main window
    const unlisten = listen<PermissionData>("permission-request", (event) => {
      setData(event.payload);
    });

    // Request initial data
    invoke("get_pending_permission").catch(() => {});

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleReply = async (reply: "once" | "always" | "reject") => {
    if (!data || responding) return;
    
    setResponding(true);
    try {
      // Emit the reply back
      await invoke("permission_reply", {
        instanceUrl: data.instanceUrl,
        sessionId: data.request.sessionID,
        requestId: data.request.id,
        reply,
      });
      
      // Close the popup window
      await invoke("hide_permission_popup");
    } catch (error) {
      console.error("Failed to reply to permission:", error);
    } finally {
      setResponding(false);
    }
  };

  const getPermissionIcon = (permission: string) => {
    if (permission.includes("bash") || permission.includes("command")) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 9l3 3-3 3M11 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (permission.includes("write") || permission.includes("edit")) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (permission.includes("read")) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    // Default icon
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  };

  if (!data) {
    return (
      <div className="permission-popup">
        <div className="permission-popup-loading">
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="permission-popup">
      <div className="permission-popup-header">
        <div className="permission-popup-icon">
          {getPermissionIcon(data.request.permission)}
        </div>
        <div className="permission-popup-title">
          <h3>Permission Required</h3>
          <span className="permission-popup-session">{data.sessionTitle}</span>
        </div>
      </div>

      <div className="permission-popup-content">
        <div className="permission-popup-type">{data.request.permission}</div>
        <div className="permission-popup-patterns">
          {data.request.patterns.slice(0, 2).map((pattern) => (
            <code key={pattern}>{pattern}</code>
          ))}
          {data.request.patterns.length > 2 && (
            <span className="permission-popup-more">
              +{data.request.patterns.length - 2} more
            </span>
          )}
        </div>
      </div>

      <div className="permission-popup-actions">
        <button
          type="button"
          className="permission-btn deny"
          onClick={() => handleReply("reject")}
          disabled={responding}
        >
          Deny
        </button>
        <button
          type="button"
          className="permission-btn allow-once"
          onClick={() => handleReply("once")}
          disabled={responding}
        >
          Once
        </button>
        <button
          type="button"
          className="permission-btn allow-always"
          onClick={() => handleReply("always")}
          disabled={responding}
        >
          Always
        </button>
      </div>
    </div>
  );
}
