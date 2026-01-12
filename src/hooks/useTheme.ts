import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Theme } from "../lib/types";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("opentray-theme") as Theme) || "system";
  });

  useEffect(() => {
    localStorage.setItem("opentray-theme", theme);
    const root = document.documentElement;
    
    const updateTray = (currentTheme: string) => {
      invoke('update_tray_icon_theme', { theme: currentTheme }).catch(console.error);
    };

    if (theme === "system") {
      root.removeAttribute("data-theme");
      // Check system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const applySystemTheme = () => {
        const sysTheme = mediaQuery.matches ? 'dark' : 'light';
        updateTray(sysTheme);
      };
      
      applySystemTheme();
      
      mediaQuery.addEventListener('change', applySystemTheme);
      return () => mediaQuery.removeEventListener('change', applySystemTheme);
    } else {
      root.setAttribute("data-theme", theme);
      updateTray(theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
