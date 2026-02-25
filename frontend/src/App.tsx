import { useEffect, useMemo, useState } from "react";

import AdminPanel from "./components/AdminPanel";
import ChatWithDashboard from "./components/dashboard/ChatWithDashboard";
import ChatWindow from "./components/ChatWindow";
import WizardRouter from "./wizard/WizardRouter";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  Link,
} from "react-router-dom";

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

export type AppTopBarProps = {
  authUser: AuthUser | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
  showProfileMenu: boolean;
  setShowProfileMenu: (v: boolean) => void;
  showChangePassword: boolean;
  setShowChangePassword: (v: boolean) => void;
  changePasswordError: string | null;
  changePasswordSuccess: string | null;
  currentPassword: string;
  setCurrentPassword: (v: string) => void;
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  changingPassword: boolean;
  handleChangePassword: (e: React.FormEvent) => void;
  handleLogout: () => void;
  handleModeSwitch: (v: "chat" | "admin" | "developer" | "leader") => void;
  handleOpenSettings: () => void;
  roleView: "chat" | "admin" | "developer" | "leader";
  isViewerLike: boolean;
  nextThemeLabel: string;
  isAdmin: boolean;
  isDeveloper: boolean;
  isLeader: boolean;
  isDeliveryManager: boolean;
};

export const AppTopBar: React.FC<AppTopBarProps> = ({
  authUser,
  theme,
  setTheme,
  showProfileMenu,
  setShowProfileMenu,
  showChangePassword,
  setShowChangePassword,
  changePasswordError,
  changePasswordSuccess,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  changingPassword,
  handleChangePassword,
  handleLogout,
  handleModeSwitch,
  handleOpenSettings,
  roleView,
  isViewerLike,
  nextThemeLabel,
  isAdmin,
  isDeveloper,
  isLeader,
  isDeliveryManager,
}) => {
  return (
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
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700"
          aria-haspopup="menu"
          aria-expanded={showProfileMenu}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-base font-bold text-white shadow-sm dark:bg-sky-500">
            {authUser?.email?.[0]?.toUpperCase() || "U"}
          </span>
          <span className="hidden text-left text-sm leading-tight sm:block">
            <span className="block font-semibold">{authUser?.email}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {authUser?.role?.replace(/_/g, " ")}
            </span>
          </span>
          <span aria-hidden>{showProfileMenu ? "▲" : "▼"}</span>
        </button>
        {showProfileMenu && (
          <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-100">
              <div>{authUser?.email}</div>
              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {authUser?.role?.replace(/_/g, " ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                handleModeSwitch("chat");
                setShowProfileMenu(false);
              }}
              className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
                roleView === "chat" ? "bg-slate-50 dark:bg-slate-700" : ""
              }`}
            >
              <span aria-hidden>🏠</span> Dashboard Home
            </button>
            <button
              type="button"
              onClick={() => {
                handleOpenSettings();
                setShowProfileMenu(false);
              }}
              disabled={isViewerLike}
              className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-700 ${
                isViewerLike ? "cursor-not-allowed opacity-60" : ""
              }`}
              title={
                isViewerLike
                  ? "Settings available for elevated roles"
                  : "Open settings"
              }
            >
              <span aria-hidden>⚙️</span> Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setShowChangePassword(true);
                setShowProfileMenu(false);
                // Reset password fields/errors
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <span aria-hidden>🔒</span> Change Password
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme(theme === "light" ? "dark" : "light");
                setShowProfileMenu(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <span aria-hidden>{theme === "light" ? "🌙" : "🌞"}</span>
              {nextThemeLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                handleLogout();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-900/30"
            >
              <span aria-hidden>🚪</span> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(
    null
  );
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<
    string | null
  >(null);

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
    setShowProfileMenu(false);
    setShowChangePassword(false);
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError(null);
    setChangePasswordSuccess(null);
    if (!authToken) {
      setChangePasswordError("Not authenticated");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${apiBase}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.detail || res.statusText || "Failed to change password"
        );
      }
      setChangePasswordSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setChangePasswordError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setChangingPassword(false);
    }
  };

  // Wizard integration: wrap main app in Router and add /wizard/* route
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex min-h-screen w-full flex-col px-3 py-8 md:px-4 lg:px-5">
          <AppTopBar
            authUser={authUser}
            theme={theme}
            setTheme={setTheme}
            showProfileMenu={showProfileMenu}
            setShowProfileMenu={setShowProfileMenu}
            showChangePassword={showChangePassword}
            setShowChangePassword={setShowChangePassword}
            changePasswordError={changePasswordError}
            changePasswordSuccess={changePasswordSuccess}
            currentPassword={currentPassword}
            setCurrentPassword={setCurrentPassword}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmPassword={confirmPassword}
            setConfirmPassword={setConfirmPassword}
            changingPassword={changingPassword}
            handleChangePassword={handleChangePassword}
            handleLogout={handleLogout}
            handleModeSwitch={handleModeSwitch}
            handleOpenSettings={handleOpenSettings}
            roleView={roleView}
            isViewerLike={isViewerLike}
            nextThemeLabel={nextThemeLabel}
            isAdmin={isAdmin}
            isDeveloper={isDeveloper}
            isLeader={isLeader}
            isDeliveryManager={isDeliveryManager}
          />
          <main className="mt-10 flex-1 space-y-4">
            {/* Wizard Launch Button for eligible roles */}
            {/* {(isAdmin || isLeader || isDeliveryManager || isDeveloper) &&
              roleView === "chat" && (
                <div className="mb-6">
                  <Link
                    to="/wizard/drafts"
                    className="inline-block rounded-lg bg-sky-600 px-5 py-2 text-white font-semibold shadow hover:bg-sky-700 transition"
                  >
                    + New Job Posting Wizard
                  </Link>
                </div>
              )} */}
            <Routes>
              {/* Main dashboard and admin views */}
              <Route
                path="/"
                element={
                  <>
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
                  </>
                }
              />
              {/* Wizard routes */}
              <Route path="/wizard/*" element={<WizardRouter />} />
            </Routes>
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
        {showChangePassword && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/40"
              onClick={() => setShowChangePassword(false)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      Change Password
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Update your account password.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowChangePassword(false)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Close
                  </button>
                </div>
                <form className="space-y-3" onSubmit={handleChangePassword}>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      minLength={6}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      minLength={6}
                      required
                    />
                  </div>
                  {changePasswordError && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      {changePasswordError}
                    </p>
                  )}
                  {changePasswordSuccess && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      {changePasswordSuccess}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowChangePassword(false)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                    >
                      {changingPassword ? "Updating…" : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </Router>
  );
};

export default App;
