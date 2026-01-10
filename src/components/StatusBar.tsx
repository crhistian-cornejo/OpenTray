import { AnimatedStatus } from "./AnimatedStatus";

interface StatusBarProps {
  modelName?: string;
  providerName?: string;
  status: "idle" | "busy" | "retry";
}

export function StatusBar({ modelName, providerName, status }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-bar-indicator">
          <AnimatedStatus status={status} />
        </span>
      </div>
      <div className="status-bar-right">
        {providerName && (
          <span className="status-bar-provider">{providerName}</span>
        )}
        {modelName && (
          <span className="status-bar-model">{modelName}</span>
        )}
      </div>
    </div>
  );
}
