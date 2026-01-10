import { useState } from "react";
import type { FileDiff } from "../lib/types";
import DiffViewer from "./DiffViewer";

interface DiffViewProps {
  diffs: FileDiff[];
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getFileDir(path: string): string {
  const parts = path.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

function getFileIcon(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    ts: "TS",
    tsx: "TSX",
    js: "JS",
    jsx: "JSX",
    css: "CSS",
    json: "{}",
    md: "MD",
    rs: "RS",
    py: "PY",
    html: "<>",
    toml: "TML",
  };
  return icons[ext] || "F";
}

export function DiffView({ diffs }: DiffViewProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (file: string) => {
    setExpanded((prev) => ({ ...prev, [file]: !prev[file] }));
  };

  const totalAdditions = diffs.reduce((acc, d) => acc + d.additions, 0);
  const totalDeletions = diffs.reduce((acc, d) => acc + d.deletions, 0);

  return (
    <div className="diffs fade-in">
      {diffs.length > 0 && (
        <div className="diff-summary">
          <span className="diff-summary-count">{diffs.length} file{diffs.length !== 1 ? "s" : ""} changed</span>
          <div className="diff-summary-stats">
            <span className="diff-add">+{totalAdditions}</span>
            <span className="diff-del">-{totalDeletions}</span>
          </div>
        </div>
      )}
      
      {diffs.length === 0 && (
        <div className="empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="empty-icon" aria-hidden="true">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>No changes yet</p>
        </div>
      )}
      
      {diffs.map((diff) => {
        const isExpanded = expanded[diff.file] ?? true;
        const fileName = getFileName(diff.file);
        const fileDir = getFileDir(diff.file);
        
        return (
          <div key={diff.file} className="diff-item">
            <button
              type="button"
              className="diff-header"
              onClick={() => toggleExpand(diff.file)}
            >
              <div className="diff-header-left">
                <span className={`diff-expand-icon ${isExpanded ? "expanded" : ""}`}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4 5l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span className="diff-file-icon">{getFileIcon(diff.file)}</span>
                <div className="diff-file-info">
                  <span className="diff-file-name">{fileName}</span>
                  {fileDir && <span className="diff-file-path">{fileDir}</span>}
                </div>
              </div>
              <div className="diff-header-right">
                <span className="diff-add">+{diff.additions}</span>
                <span className="diff-del">-{diff.deletions}</span>
              </div>
            </button>
            {isExpanded && (
              <div className="diff-content-wrapper">
                <DiffViewer diff={diff} maxLines={50} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
