import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PermissionPopup } from "./components/PermissionPopup";
import "./styles.scss";

// Simple hash-based routing for multiple windows
function Router() {
  const hash = window.location.hash;
  
  if (hash === "#/permission") {
    return <PermissionPopup />;
  }
  
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
