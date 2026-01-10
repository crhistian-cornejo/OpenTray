import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";

// Check if updater is enabled (injected by Rust backend)
declare global {
  interface Window {
    __OPENTRAY__?: {
      updaterEnabled?: boolean;
    };
  }
}

const UPDATER_ENABLED = window.__OPENTRAY__?.updaterEnabled ?? false;

interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

interface UseUpdaterReturn {
  updaterEnabled: boolean;
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloading: boolean;
  progress: number;
  error: string | null;
  checkForUpdates: (alertOnFail?: boolean) => Promise<void>;
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

  const checkForUpdates = useCallback(async (alertOnFail = false) => {
    if (!UPDATER_ENABLED) {
      if (alertOnFail) {
        await message("Updates are not available in development mode", { 
          title: "Update Check" 
        });
      }
      return;
    }

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
        if (alertOnFail) {
          await message("You are already using the latest version of OpenTray", { 
            title: "No Update Available" 
          });
        }
      }
    } catch (err) {
      console.error("Failed to check for updates:", err);
      setError(err instanceof Error ? err.message : "Failed to check for updates");
      if (alertOnFail) {
        await message("Failed to check for updates", { title: "Update Check Failed" });
      }
    }
  }, []);

  const installUpdate = useCallback(async () => {
    if (!update || !UPDATER_ENABLED) return;

    try {
      setDownloading(true);
      setProgress(0);
      setError(null);

      let downloaded = 0;
      let contentLength = 0;

      // Download the update
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = (event.data as { contentLength?: number }).contentLength ?? 0;
            setProgress(0);
            break;
          case "Progress": {
            const chunkLength = (event.data as { chunkLength: number }).chunkLength;
            downloaded += chunkLength;
            if (contentLength > 0) {
              setProgress(Math.min((downloaded / contentLength) * 100, 100));
            }
            break;
          }
          case "Finished":
            setProgress(100);
            break;
        }
      });

      // Ask user if they want to relaunch
      const shouldRelaunch = await ask(
        `Version ${update.version} has been installed. Would you like to relaunch OpenTray now?`,
        { title: "Update Installed" }
      );

      if (shouldRelaunch) {
        await relaunch();
      }
    } catch (err) {
      console.error("Failed to install update:", err);
      setError(err instanceof Error ? err.message : "Failed to install update");
      await message("Failed to install update", { title: "Update Failed" });
      setDownloading(false);
    }
  }, [update]);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
    setUpdateInfo(null);
    setUpdate(null);
  }, []);

  // Check for updates on mount (with delay to not slow startup)
  useEffect(() => {
    if (!UPDATER_ENABLED) return;

    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  return {
    updaterEnabled: UPDATER_ENABLED,
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
