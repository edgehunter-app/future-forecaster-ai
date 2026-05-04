import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Service worker registration — only in production, not in iframe/preview
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app") && window.location.hostname.includes("id-preview");

if ("serviceWorker" in navigator) {
  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    // Clean up any previously registered SW in preview/dev contexts
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("EdgeHunter SW registered:", reg.scope))
        .catch((err) => console.warn("EdgeHunter SW registration failed:", err));
    });
  }
}
