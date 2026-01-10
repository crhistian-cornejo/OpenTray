import { useMemo } from "react";
import { structuredPatch } from "diff";
import { Highlight, themes } from "prism-react-renderer";
import type { FileDiff } from "../lib/types";

interface DiffViewerProps {
  diff: FileDiff;
  maxLines?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// Get language from file extension
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    swift: "swift",
    kt: "kotlin",
    php: "php",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    toml: "toml",
    xml: "markup",
    vue: "markup",
    svelte: "markup",
  };
  return langMap[ext] || "text";
}

export function DiffViewer({ diff, maxLines = 100 }: DiffViewerProps) {
  const lines = useMemo<DiffLine[]>(() => {
    const patch = structuredPatch(
      diff.file,
      diff.file,
      diff.before,
      diff.after,
      "",
      "",
      { context: 3 }
    );

    const result: DiffLine[] = [];

    for (const hunk of patch.hunks) {
      result.push({
        type: "header",
        content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      });

      let oldLine = hunk.oldStart;
      let newLine = hunk.newStart;

      for (const line of hunk.lines) {
        if (line.startsWith("+")) {
          result.push({
            type: "add",
            content: line.slice(1),
            newLineNum: newLine++,
          });
        } else if (line.startsWith("-")) {
          result.push({
            type: "remove",
            content: line.slice(1),
            oldLineNum: oldLine++,
          });
        } else {
          result.push({
            type: "context",
            content: line.slice(1),
            oldLineNum: oldLine++,
            newLineNum: newLine++,
          });
        }
      }
    }

    return result.slice(0, maxLines);
  }, [diff, maxLines]);

  const truncated = lines.length >= maxLines;
  const language = getLanguage(diff.file);

  // Combine all content for highlighting (preserves token context)
  const allCode = lines.filter(l => l.type !== "header").map(l => l.content).join("\n");

  return (
    <div className="diff-viewer">
      <Highlight theme={themes.vsDark} code={allCode} language={language}>
        {({ tokens: _tokens }) => {
          // We need to render line by line matching our diff structure
          let tokenLineIndex = 0;
          
          return (
            <div className="diff-lines">
              {lines.map((line, idx) => {
                if (line.type === "header") {
                  return (
                    <div key={`header-${line.content}`} className="diff-line diff-line-header">
                      <span className="diff-gutter" />
                      <span className="diff-line-prefix" />
                      <span className="diff-line-content">{line.content}</span>
                    </div>
                  );
                }
                
                const currentTokenLine = _tokens[tokenLineIndex] || [];
                tokenLineIndex++;
                
                return (
                  <div key={`${line.type}-${line.oldLineNum ?? idx}-${line.newLineNum ?? idx}`} className={`diff-line diff-line-${line.type}`}>
                    <span className="diff-gutter">
                      <span className="diff-line-old">{line.oldLineNum ?? ""}</span>
                      <span className="diff-line-new">{line.newLineNum ?? ""}</span>
                    </span>
                    <span className="diff-line-prefix">
                      {line.type === "add" && "+"}
                      {line.type === "remove" && "-"}
                      {line.type === "context" && " "}
                    </span>
                    <span className="diff-line-content">
                      {currentTokenLine.map((token, tokenIdx) => (
                        <span key={`${token.content.slice(0, 10)}-${tokenIdx}`} className={`token ${token.types.join(" ")}`}>
                          {token.content}
                        </span>
                      ))}
                      {currentTokenLine.length === 0 && line.content}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        }}
      </Highlight>
      {truncated && (
        <div className="diff-truncated">
          Showing first {maxLines} lines...
        </div>
      )}
    </div>
  );
}

export default DiffViewer;
