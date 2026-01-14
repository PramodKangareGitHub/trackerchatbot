import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import ChatWindow from "./components/ChatWindow";

type AuthUser = {
  id: string;
  email: string;
  role: "viewer" | "admin" | "developer";
};

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "theme";

const normalizeRole = (role: string): AuthUser["role"] => {
  const normalized = (role || "").trim().toLowerCase();
  if (normalized === "admin" || normalized === "developer") return normalized;
  return "viewer";
};

const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

const App = () => {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [roleView, setRoleView] = useState<"chat" | "admin" | "developer">(
    "chat"
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

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

  const handleModeSwitch = (nextView: "chat" | "admin" | "developer") => {
    setRoleView(nextView);
    setAuthError(null);
  };

  const persistAuth = (token: string, user: AuthUser) => {
    const normalizedUser = { ...user, role: normalizeRole(user.role) };
    setAuthToken(token);
    setAuthUser(normalizedUser);
    setRoleView(normalizedUser.role === "developer" ? "developer" : "chat");
    window.localStorage.setItem("auth_token", token);
    window.localStorage.setItem("auth_user", JSON.stringify(normalizedUser));
  };

  const clearAuth = () => {
    setAuthToken(null);
    setAuthUser(null);
    setRoleView("chat");
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("auth_user");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_BASE || "http://localhost:8000") +
          "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: loginEmail, password: loginPassword }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Login failed");
      }
      const data = await res.json();
      const nextUser: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        role: normalizeRole(data.user.role),
      };
      persistAuth(data.access_token, nextUser);
      setLoginEmail("");
      setLoginPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
  };

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";

  useEffect(() => {
    const storedToken = window.localStorage.getItem("auth_token");
    const storedUser = window.localStorage.getItem("auth_user");
    if (storedToken && storedUser) {
      try {
        const parsed: AuthUser = JSON.parse(storedUser);
        const normalizedUser = { ...parsed, role: normalizeRole(parsed.role) };
        setAuthUser(normalizedUser);
        setAuthToken(storedToken);
        setRoleView(normalizedUser.role === "developer" ? "developer" : "chat");
        // validate token
        fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        })
          .then((res) => {
            if (!res.ok) throw new Error("Session expired");
            return res.json();
          })
          .then((me) => {
            if (!me?.role) return;
            setAuthUser((prev) =>
              prev ? { ...prev, role: normalizeRole(me.role) } : prev
            );
            setRoleView(
              normalizeRole(me.role) === "developer" ? "developer" : "chat"
            );
          })
          .catch(() => clearAuth());
      } catch {
        clearAuth();
      }
    }
  }, [apiBase]);

  const isAuthed = Boolean(authToken && authUser);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h1 className="mb-1 flex items-center gap-2 text-2xl font-semibold text-sky-600">
              <span aria-hidden>🤖</span> Tracker Chatbot
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Please log in to continue.
            </p>
            <form className="mt-4 space-y-3" onSubmit={handleLogin}>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Enter password"
                  required
                />
              </div>
              {authError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="btn-outline-primary w-full px-4 py-2 text-sm"
              >
                {authLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const isViewer = authUser?.role === "viewer";
  const isAdmin = authUser?.role === "admin";
  const isDeveloper = authUser?.role === "developer";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-3 py-8 md:px-4 lg:px-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-semibold text-sky-600">
              <span aria-hidden className="text-3xl" title="Tracker Chatbot">
                🤖
              </span>
              Tracker Chatbot
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Smart conversations over your tracking sheets
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(isAdmin || isDeveloper) && (
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100/60 px-2 py-1 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-800/60 dark:ring-indigo-900/30">
                <button
                  type="button"
                  onClick={() => handleModeSwitch("chat")}
                  className={`segmented-tab ${
                    roleView === "chat" ? "segmented-tab--active" : ""
                  }`}
                >
                  <span aria-hidden>💬</span>
                  Chat View
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("admin")}
                    className={`segmented-tab ${
                      roleView === "admin" ? "segmented-tab--active" : ""
                    }`}
                  >
                    <span aria-hidden>🛠️</span>
                    Admin View
                  </button>
                )}
                {isDeveloper && (
                  <button
                    type="button"
                    onClick={() => handleModeSwitch("developer")}
                    className={`segmented-tab ${
                      roleView === "developer" ? "segmented-tab--active" : ""
                    }`}
                  >
                    <span aria-hidden>💻</span>
                    Developer View
                  </button>
                )}
              </div>
            )}
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
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
              {authUser?.email} ({authUser?.role})
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-outline-primary px-3 py-1 text-xs"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mt-10 flex-1 space-y-4">
          {authError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {authError}
            </p>
          )}

          {isViewer && <ChatWindow key="viewer" authToken={authToken} />}

          {isAdmin &&
            (roleView === "admin" ? (
              <AdminPanel
                key="admin"
                authToken={authToken!}
                authUserRole={authUser.role}
              />
            ) : (
              <ChatWindow key={`admin-${roleView}`} authToken={authToken} />
            ))}

          {isDeveloper &&
            (roleView === "developer" ? (
              <AdminPanel
                key="developer-admin"
                authToken={authToken!}
                authUserRole={authUser.role}
              />
            ) : (
              <ChatWindow
                key={`developer-${roleView}`}
                showSql
                authToken={authToken}
              />
            ))}
        </main>
      </div>
    </div>
  );
};

export default App;
