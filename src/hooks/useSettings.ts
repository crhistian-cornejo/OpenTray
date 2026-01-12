import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface AppSettings {
  autostart: boolean;
  sound_enabled: boolean;
  compact_mode: boolean;
  global_shortcut: string;
}

const defaultSettings: AppSettings = {
  autostart: false,
  sound_enabled: true,
  compact_mode: false,
  global_shortcut: typeof window !== "undefined" && (window as unknown as { __OPENTRAY__?: { platform?: string } }).__OPENTRAY__?.platform === "macos" 
    ? "Cmd+Shift+O" 
    : "Ctrl+Shift+O",
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await invoke<AppSettings>("get_settings");
        setSettings({ ...defaultSettings, ...loaded });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await invoke("save_settings", { settings: newSettings });
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }, [settings]);

  return { settings, updateSettings, loading };
}
