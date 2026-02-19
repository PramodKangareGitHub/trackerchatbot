import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import ChatWithDashboard from "./components/dashboard/ChatWithDashboard";
import ChatWindow from "./components/ChatWindow";

type AuthUser = {
  id: string;
  email: string;
  role: "viewer" | "admin" | "developer" | "leader" | "delivery_manager";
};

type Theme = "light" | "dark";
const THEME_STORAGE_KEY = "theme";

const normalizeRole = (role: string): AuthUser["role"] => {
  const normalized = (role || "").trim().toLowerCase();
  if (
    ["admin", "developer", "leader", "delivery_manager"].includes(normalized)
  ) {
    return normalized as AuthUser["role"];
  }
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
  const [roleView, setRoleView] = useState<
    "chat" | "admin" | "developer" | "leader"
  >("chat");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showFloatingChat, setShowFloatingChat] = useState(false);

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

  const handleModeSwitch = (
    nextView: "chat" | "admin" | "developer" | "leader"
  ) => {
    setRoleView(nextView);
    setAuthError(null);
  };

  const handleOpenSettings = () => {
    if (isAdmin) return handleModeSwitch("admin");
    if (isDeveloper) return handleModeSwitch("developer");
    if (isLeader || isDeliveryManager) return handleModeSwitch("leader");
    return handleModeSwitch("chat");
  };

  const persistAuth = (token: string, user: AuthUser) => {
    const normalizedUser = { ...user, role: normalizeRole(user.role) };
    setAuthToken(token);
    setAuthUser(normalizedUser);
    setRoleView("chat");
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
        setRoleView("chat");
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
            const normalizedRole = normalizeRole(me.role);
            setRoleView("chat");
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
              <span aria-hidden>🤖</span> UHG Talent Vista
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

  const isAdmin = authUser?.role === "admin";
  const isDeveloper = authUser?.role === "developer";
  const isLeader = authUser?.role === "leader";
  const isDeliveryManager = authUser?.role === "delivery_manager";
  const isViewerLike =
    !isAdmin && !isDeveloper && !isLeader && !isDeliveryManager;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-3 py-8 md:px-4 lg:px-5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-semibold text-sky-600">
              <span aria-hidden className="text-3xl" title="UHG Talent Vista">
                🤖
              </span>
              UHG Talent Vista
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              &nbsp;&nbsp;One View. Total Workforce Clarity.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100/60 px-2 py-1 shadow-sm ring-1 ring-indigo-100 dark:bg-slate-800/60 dark:ring-indigo-900/30">
              <button
                type="button"
                onClick={() => handleModeSwitch("chat")}
                className={`segmented-tab ${
                  roleView === "chat" ? "segmented-tab--active" : ""
                }`}
              >
                <span aria-hidden>💬</span>
                Dashboard View
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                disabled={isViewerLike}
                className={`segmented-tab ${
                  roleView !== "chat" ? "segmented-tab--active" : ""
                } ${isViewerLike ? "opacity-50 cursor-not-allowed" : ""}`}
                title={
                  isViewerLike
                    ? "Settings available for elevated roles"
                    : "Open settings"
                }
              >
                <span aria-hidden>⚙️</span>
                Settings
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

          {isViewerLike && (
            <ChatWithDashboard
              key="viewer"
              authToken={authToken}
              authUserRole={authUser?.role}
              hideChat
            />
          )}

          {(isLeader || isDeliveryManager) &&
            (roleView === "leader" ? (
              <AdminPanel
                key="leader-admin"
                authToken={authToken!}
                authUserRole={authUser.role}
                allowedSections={["dashboard", "banners"]}
              />
            ) : (
              <ChatWithDashboard
                key="leader-chat"
                authToken={authToken}
                authUserRole={authUser.role}
                hideChat
              />
            ))}

          {isAdmin &&
            (roleView === "admin" ? (
              <AdminPanel
                key="admin"
                authToken={authToken!}
                authUserRole={authUser.role}
              />
            ) : (
              <ChatWithDashboard
                key={`admin-${roleView}`}
                authToken={authToken}
                authUserRole={authUser.role}
                hideChat
              />
            ))}

          {isDeveloper &&
            (roleView === "developer" ? (
              <AdminPanel
                key="developer-admin"
                authToken={authToken!}
                authUserRole={authUser.role}
              />
            ) : (
              <ChatWithDashboard
                key={`developer-${roleView}`}
                authToken={authToken}
                authUserRole={authUser.role}
                hideChat
              />
            ))}
        </main>
      </div>

      {/* Floating chat launcher */}
      <button
        type="button"
        onClick={() => setShowFloatingChat(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-2xl text-white shadow-xl transition hover:scale-105 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-200 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus:ring-sky-800"
        aria-label="Open chat"
      >
        💬
      </button>

      {showFloatingChat && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/30"
            onClick={() => setShowFloatingChat(false)}
          />
          <div className="fixed bottom-6 right-6 z-50 w-[90vw] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <span>Chat</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFloatingChat(false)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="h-[70vh] overflow-hidden bg-white dark:bg-slate-900">
              <ChatWindow
                key="floating-chat"
                authToken={authToken}
                showSql={isDeveloper}
                heightClass="h-full max-h-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
