// Utility functions

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

export function getToolStatusIcon(status: string): string {
  switch (status) {
    case "pending": return "\u23F3"; // hourglass
    case "running": return "\u26A1"; // lightning
    case "completed": return "\u2713"; // check
    case "error": return "\u2717"; // x
    default: return "\u2022"; // bullet
  }
}

export function getDirectoryName(path: string): string {
  return path.split("/").pop() || path;
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
