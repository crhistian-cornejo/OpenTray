import { useState, useEffect } from "react";
import type { Theme } from "../lib/types";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("opentray-theme") as Theme) || "system";
  });

  useEffect(() => {
    localStorage.setItem("opentray-theme", theme);
    const root = document.documentElement;
    
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
