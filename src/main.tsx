import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("PetLog could not render:", error);
  }
  render() {
    if (this.state.failed)
      return (
        <main className="gate-loading" role="alert">
          <div className="card gate-error">
            <h1>აპის გახსნა ვერ მოხერხდა</h1>
            <p className="muted">
              გვერდის განახლება შენახულ მონაცემებს არ წაშლის.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => location.reload()}
            >
              გვერდის განახლება
            </button>
          </div>
        </main>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
);

// Retire the previous static application's service worker so it cannot serve stale UI.
if ("serviceWorker" in navigator) {
  const scope = new URL(import.meta.env.BASE_URL, location.href).href;
  const legacyScript = new URL("sw.js", scope).href;
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(
        registrations
          .filter(
            (registration) =>
              registration.scope === scope &&
              registration.active?.scriptURL === legacyScript,
          )
          .map((registration) => registration.unregister()),
      ),
    )
    .catch(() => {});
}
