import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import ChatWindow from "./components/ChatWindow";

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "theme";

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const App = () => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [mode, setMode] = useState<"viewer" | "admin" | "developer">("viewer");
  const [authedRole, setAuthedRole] = useState<"admin" | "developer" | null>(
    null
  );
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [devView, setDevView] = useState<"chat" | "admin">("chat");

  const ROLE_PASSWORD = "letmein";

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const nextThemeLabel = useMemo(
    () => (theme === "light" ? "Switch to Dark" : "Switch to Light"),
    [theme]
  );

  const handleModeSwitch = (nextMode: "viewer" | "admin" | "developer") => {
    setMode(nextMode);
    setAuthError(null);
    setPasswordInput("");
    setDevView("chat");
    if (nextMode === "viewer") {
      setAuthedRole(null);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "viewer") return;
    if (passwordInput === ROLE_PASSWORD) {
      setAuthedRole(mode);
      setAuthError(null);
      setPasswordInput("");
    } else {
      setAuthError("Incorrect password");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-3 py-8 md:px-4 lg:px-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-semibold text-sky-600">
              <span aria-hidden className="text-3xl">
                📡
              </span>
              Tracker Chatbot
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Smart conversations over your tracking sheets
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100/60 px-2 py-1 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-800/60 dark:ring-indigo-900/30">
              <button
                type="button"
                onClick={() => handleModeSwitch("viewer")}
                className={`segmented-tab ${
                  mode === "viewer" ? "segmented-tab--active" : ""
                }`}
              >
                <span aria-hidden>👁️</span>
                Viewer
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("admin")}
                className={`segmented-tab ${
                  mode === "admin" ? "segmented-tab--active" : ""
                }`}
              >
                <span aria-hidden>🛠️</span>
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("developer")}
                className={`segmented-tab ${
                  mode === "developer" ? "segmented-tab--active" : ""
                }`}
              >
                <span aria-hidden>💻</span>
                Developer
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="btn-outline-primary gap-2 rounded-full px-4 py-2"
              aria-label="Toggle theme"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                aria-hidden
              >
                {theme === "light" ? "🌞" : "🌙"}
              </span>
              {nextThemeLabel}
            </button>
          </div>
        </header>

        <main className="mt-10 flex-1 space-y-4">
          {mode !== "viewer" && authedRole === mode && mode === "admin" && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleModeSwitch("viewer")}
                className="btn-outline-primary rounded-full px-3 py-1.5 text-xs"
              >
                ← Back to chat
              </button>
            </div>
          )}

          {mode === "viewer" && <ChatWindow />}

          {mode === "admin" &&
            (authedRole === "admin" ? (
              <AdminPanel />
            ) : (
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Admin Login
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter the password to continue.
                </p>
                <form className="mt-4 space-y-3" onSubmit={handleLogin}>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Password
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Enter password"
                      autoFocus
                    />
                  </div>
                  {authError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {authError}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="btn-outline-primary px-3 py-1.5 text-sm"
                      onClick={() => handleModeSwitch("viewer")}
                    >
                      Back to chat
                    </button>
                    <button
                      type="submit"
                      className="btn-outline-primary px-4 py-2 text-sm"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </div>
            ))}

          {mode === "developer" &&
            (authedRole === "developer" ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <button
                      type="button"
                      onClick={() => setDevView("chat")}
                      className={`px-3 py-1.5 transition ${
                        devView === "chat"
                          ? "bg-sky-600 text-white"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Chat (SQL shown)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDevView("admin")}
                      className={`px-3 py-1.5 transition ${
                        devView === "admin"
                          ? "bg-sky-600 text-white"
                          : "hover:bg-slate-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Admin panel
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("viewer")}
                    className="text-xs text-slate-500 underline"
                  >
                    Back to viewer
                  </button>
                </div>
                {devView === "chat" ? <ChatWindow showSql /> : <AdminPanel />}
              </div>
            ) : (
              <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Developer Login
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enter the password to continue.
                </p>
                <form className="mt-4 space-y-3" onSubmit={handleLogin}>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Password
                    </label>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Enter password"
                      autoFocus
                    />
                  </div>
                  {authError && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {authError}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="btn-outline-primary px-3 py-1.5 text-sm"
                      onClick={() => handleModeSwitch("viewer")}
                    >
                      Back to chat
                    </button>
                    <button
                      type="submit"
                      className="btn-outline-primary px-4 py-2 text-sm"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              </div>
            ))}
        </main>
      </div>
    </div>
  );
};

export default App;
