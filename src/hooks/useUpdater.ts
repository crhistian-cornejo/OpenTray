import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";

interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

interface UseUpdaterReturn {
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

export function useUpdater(): UseUpdaterReturn {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      setError(null);
      const result = await check();
      
      if (result) {
        setUpdate(result);
        setUpdateAvailable(true);
        setUpdateInfo({
          version: result.version,
          body: result.body ?? undefined,
          date: result.date ?? undefined,
        });
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setError(err instanceof Error ? err.message : "Failed to check for updates");
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update) return;

    try {
      setDownloading(true);
      setProgress(0);
      setError(null);

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            setProgress(0);
            break;
          case "Progress": {
            const contentLength = event.data.contentLength ?? 0;
            const chunkLength = event.data.chunkLength;
            if (contentLength > 0) {
              setProgress((prev) => Math.min(prev + (chunkLength / contentLength) * 100, 100));
            }
            break;
          }
          case "Finished":
            setProgress(100);
            break;
        }
      });

      // The app will restart automatically after install
    } catch (err) {
      console.error("Failed to install update:", err);
      setError(err instanceof Error ? err.message : "Failed to install update");
      setDownloading(false);
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
    setUpdateInfo(null);
    setUpdate(null);
  }, []);

  // Check for updates on mount
  useEffect(() => {
    // Delay check to not slow down startup
    const timer = setTimeout(() => {
      checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    updateAvailable,
    updateInfo,
    downloading,
    progress,
    error,
    checkForUpdates,
    installUpdate,
    dismissUpdate,
  };
}
