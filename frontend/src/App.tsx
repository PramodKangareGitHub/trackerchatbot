import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import ChatWindow from "./components/ChatWindow";

type ChatSectionProps = {
  authToken: string | null;
  authUserRole?: string | null;
  showSql?: boolean;
};

type DashboardChartConfig = {
  dataset_id?: string;
  x_field?: string;
  y_field?: string;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_values?: string[];
};

const DashboardChartPreview = ({
  title,
  config,
  columns,
  rows,
}: {
  title?: string;
  config: DashboardChartConfig;
  columns: string[];
  rows: Record<string, unknown>[];
}) => {
  const groupBy = config.group_by || "";
  const groupValues = config.group_by_values || [];
  const filteredRows = rows.filter((row) => {
    if (!groupBy) return true;
    const key = row[groupBy];
    const label = key === null || key === undefined ? "(blank)" : String(key);
    return !groupValues.length || groupValues.includes(label);
  });

  const xKey = config.x_field || columns[0];
  const yKey = config.y_field;
  if (!xKey) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Pick X (and Y) to see a chart.
      </div>
    );
  }

  const aggregated = new Map<
    string,
    {
      xLabel: string;
      groupLabel: string;
      yLabel: string;
      count: number;
    }
  >();

  filteredRows.forEach((row) => {
    const xRaw = row[xKey];
    const xLabel =
      xRaw === null || xRaw === undefined ? "(blank)" : String(xRaw);
    const gRaw = groupBy ? row[groupBy] : undefined;
    const gLabel = groupBy
      ? gRaw === null || gRaw === undefined
        ? "(blank)"
        : String(gRaw)
      : "";
    const yValRaw = yKey ? row[yKey] : undefined;
    const yLabel = yKey
      ? yValRaw === null || yValRaw === undefined
        ? "(blank)"
        : String(yValRaw)
      : "";

    const bucketKey = groupBy ? `${xLabel}|||${gLabel}` : xLabel;
    if (!aggregated.has(bucketKey)) {
      aggregated.set(bucketKey, {
        xLabel,
        groupLabel: gLabel,
        yLabel,
        count: 0,
      });
    }
    const entry = aggregated.get(bucketKey)!;
    entry.count += 1;
    if (yLabel && !entry.yLabel) entry.yLabel = yLabel;
  });

  const points = Array.from(aggregated.values());
  if (!points.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No data to chart.
      </div>
    );
  }

  const valueMax = Math.max(1, ...points.map((p) => p.count));
  const barHeight = 180;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
        <span>{title || "Chart"}</span>
        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-amber-500" /> Count
          {yKey && <span className="text-sky-500">• Y</span>}
        </span>
      </div>
      <div
        className="flex items-end gap-3 overflow-x-auto"
        style={{ minHeight: "220px" }}
      >
        {points.map((p, idx) => {
          const h = Math.max(8, (p.count / valueMax) * barHeight);
          const barWidth = Math.max(28, Math.min(96, 520 / points.length));
          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300"
            >
              <div
                className="flex flex-col items-center gap-1"
                style={{ width: `${barWidth}px` }}
              >
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {p.count}
                </div>
                {yKey && p.yLabel && (
                  <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                    {p.yLabel} ({p.count})
                  </div>
                )}
                <div
                  className="w-full rounded-t-md bg-amber-500"
                  style={{ height: `${h}px` }}
                />
              </div>
              <div className="w-32 text-center text-[11px]">
                <div className="font-semibold text-slate-700 dark:text-slate-100">
                  {p.xLabel}
                </div>
                {groupBy && p.groupLabel && (
                  <div className="text-slate-500 dark:text-slate-400">
                    {p.groupLabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChatWithDashboard = ({
  authToken,
  authUserRole,
  showSql,
}: ChatSectionProps) => {
  const [widgetOptions, setWidgetOptions] = useState<
    { id: string; title: string; widget_type?: string | null; config?: any }[]
  >([]);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>(["all"]);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<
    {
      widgetId: string;
      title: string;
      widgetType?: string | null;
      config?: any;
      columns: string[];
      rows: Record<string, unknown>[];
    }[]
  >([]);

  useEffect(() => {
    const load = async () => {
      if (!authToken) return;
      setWidgetLoading(true);
      setWidgetError(null);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/admin/dashboard-config`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load widgets"
          );
        }
        const data = await res.json();
        const widgets = Array.isArray(data?.widgets) ? data.widgets : [];
        const userRole = (authUserRole || "viewer").toLowerCase();
        const options = widgets
          .map(
            (w: {
              id?: string;
              title?: string;
              widget_type?: string;
              config?: any;
              roles?: string[];
            }) => ({
              id: String(w.id ?? ""),
              title: w.title || "Untitled",
              widget_type: w.widget_type,
              config: w.config,
              roles: Array.isArray(w.roles) ? w.roles : [],
            })
          )
          .filter((w) => w.id);

        const scoped = options.filter((w) => {
          const roles = Array.isArray(w.roles) ? w.roles : [];
          if (!roles.length) return userRole === "admin"; // fallback: only admins see unscoped widgets
          return roles.includes(userRole as string);
        });

        setWidgetOptions(scoped);
      } catch (err) {
        setWidgetError(err instanceof Error ? err.message : String(err));
      } finally {
        setWidgetLoading(false);
      }
    };

    load();
  }, [authToken]);

  const handleWidgetToggle = (id: string) => {
    if (id === "all") {
      setSelectedWidgetIds(["all"]);
      return;
    }

    setSelectedWidgetIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((v) => v !== id)
        : [...prev.filter((v) => v !== "all"), id];
      return next.length ? next : ["all"];
    });
  };

  const widgetSummary = selectedWidgetIds.includes("all")
    ? "All widgets"
    : `${selectedWidgetIds.length} selected`;

  const targetWidgets = useMemo(
    () =>
      selectedWidgetIds.includes("all")
        ? widgetOptions
        : widgetOptions.filter((w) => selectedWidgetIds.includes(w.id)),
    [selectedWidgetIds, widgetOptions]
  );

  const buildPreviewTable = (
    cfg: any,
    datasetCols: string[],
    rows: Record<string, unknown>[]
  ): { columns: string[]; rows: Record<string, unknown>[] } => {
    const groupBy = cfg.group_by || "";
    const groupValues: string[] = cfg.group_by_values || [];
    const baseColumns = cfg.fields?.length ? cfg.fields : datasetCols;
    const columns = (baseColumns || []).filter((c: string) => c);

    if (groupBy) {
      const filteredRows = rows.filter((row) => {
        const key = row[groupBy];
        const label =
          key === null || key === undefined ? "(blank)" : String(key);
        return !groupValues.length || groupValues.includes(label);
      });

      const showGroupColumn = groupValues.length !== 1;
      const finalColumns = showGroupColumn
        ? Array.from(new Set([...columns, groupBy, "count"]))
        : Array.from(
            new Set([...columns.filter((c) => c !== groupBy), "count"])
          );

      const grouped = new Map<
        string,
        { count: number; row: Record<string, unknown> }
      >();

      filteredRows.forEach((row) => {
        const groupKeyRaw = row[groupBy];
        const groupLabel =
          groupKeyRaw === null || groupKeyRaw === undefined
            ? "(blank)"
            : String(groupKeyRaw);

        const keyParts = [
          groupLabel,
          ...columns.map((c) => String(row[c] ?? "")),
        ];
        const key = keyParts.join("|");

        if (!grouped.has(key)) {
          const baseRow: Record<string, unknown> = {};
          columns.forEach((c) => {
            baseRow[c] = row[c];
          });
          if (showGroupColumn) {
            baseRow[groupBy] = groupLabel;
          }
          grouped.set(key, { count: 0, row: baseRow });
        }

        const entry = grouped.get(key)!;
        entry.count += 1;
      });

      const rowsOut = Array.from(grouped.values()).map(({ count, row }) => ({
        ...row,
        count,
      }));

      return { columns: finalColumns, rows: rowsOut };
    }

    const rowsOut = rows.slice(0, 50).map((row) => {
      const out: Record<string, unknown> = {};
      columns.forEach((c) => {
        out[c] = row[c];
      });
      return out;
    });
    return { columns, rows: rowsOut };
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadPreviews = async () => {
      if (!authToken || !targetWidgets.length) {
        setPreviewItems([]);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const results: {
        widgetId: string;
        title: string;
        widgetType?: string | null;
        config?: any;
        columns: string[];
        rows: Record<string, unknown>[];
      }[] = [];

      for (const widget of targetWidgets) {
        const cfg = widget.config || {};
        const datasetId = cfg.dataset_id;
        if (!datasetId) continue;
        try {
          const res = await fetch(
            `${apiBase}/api/admin/datasets/${datasetId}/records?limit=50`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
              signal: controller.signal,
            }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              body.detail || res.statusText || "Failed to load preview"
            );
          }
          const data = await res.json();
          const datasetCols: string[] = data?.columns || [];
          const rows: Record<string, unknown>[] = data?.rows || [];
          const { columns, rows: builtRows } = buildPreviewTable(
            cfg,
            datasetCols,
            rows
          );
          results.push({
            widgetId: widget.id,
            title: widget.title,
            widgetType: widget.widget_type,
            config: cfg,
            columns,
            rows: builtRows,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      }

      setPreviewItems(results);
      setPreviewLoading(false);
    };

    loadPreviews();

    return () => {
      controller.abort();
    };
  }, [authToken, targetWidgets]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,25%),1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Dashboard
        </h3>
        <div className="mt-4 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Widgets
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setWidgetPickerOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm hover:border-slate-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <span>{widgetSummary}</span>
              <span aria-hidden className="text-slate-400">
                ▾
              </span>
            </button>
            {widgetPickerOpen && (
              <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedWidgetIds.includes("all")}
                    onChange={() => handleWidgetToggle("all")}
                  />
                  All
                </label>
                {widgetOptions.map((w) => (
                  <label
                    key={w.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedWidgetIds.includes(w.id)}
                      onChange={() => handleWidgetToggle(w.id)}
                    />
                    {w.title}
                  </label>
                ))}
              </div>
            )}
          </div>
          {widgetLoading && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Loading widgets…
            </p>
          )}
          {widgetError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {widgetError}
            </p>
          )}
          {previewLoading && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Loading preview…
            </p>
          )}
          {previewError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {previewError}
            </p>
          )}
          {!previewLoading && !previewError && !previewItems.length && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No preview available for the selected widgets.
            </p>
          )}
          {previewItems.map((item) => (
            <div
              key={item.widgetId}
              className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800 dark:text-slate-100">
                <span>{item.title}</span>
              </div>
              {item.widgetType === "chart" && item.config ? (
                <DashboardChartPreview
                  title={item.title}
                  config={item.config as DashboardChartConfig}
                  columns={item.columns}
                  rows={item.rows}
                />
              ) : (
                <div className="overflow-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead>
                      <tr>
                        {item.columns.map((c) => (
                          <th
                            key={c}
                            className="whitespace-nowrap border-b border-slate-200 px-2 py-1 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {item.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                        >
                          {item.columns.map((c) => (
                            <td
                              key={c}
                              className="whitespace-nowrap px-2 py-1 text-slate-700 dark:text-slate-200"
                            >
                              {row[c] === null || row[c] === undefined
                                ? ""
                                : String(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!item.rows.length && (
                        <tr>
                          <td
                            colSpan={item.columns.length}
                            className="px-2 py-4 text-center text-slate-500 dark:text-slate-400"
                          >
                            No rows available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <ChatWindow authToken={authToken} showSql={showSql} />
    </div>
  );
};

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
    setRoleView(
      normalizedUser.role === "developer"
        ? "developer"
        : normalizedUser.role === "admin"
          ? "admin"
          : normalizedUser.role === "leader" ||
              normalizedUser.role === "delivery_manager"
            ? "leader"
            : "chat"
    );
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
        setRoleView(
          normalizedUser.role === "developer"
            ? "developer"
            : normalizedUser.role === "admin"
              ? "admin"
              : normalizedUser.role === "leader" ||
                  normalizedUser.role === "delivery_manager"
                ? "leader"
                : "chat"
        );
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
            setRoleView(
              normalizedRole === "developer"
                ? "developer"
                : normalizedRole === "admin"
                  ? "admin"
                  : normalizedRole === "leader" ||
                      normalizedRole === "delivery_manager"
                    ? "leader"
                    : "chat"
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
            />
          )}

          {(isLeader || isDeliveryManager) &&
            (roleView === "leader" ? (
              <AdminPanel
                key="leader-admin"
                authToken={authToken!}
                authUserRole={authUser.role}
                allowedSections={["dashboard"]}
              />
            ) : (
              <ChatWithDashboard
                key="leader-chat"
                authToken={authToken}
                authUserRole={authUser.role}
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
                showSql
                authToken={authToken}
                authUserRole={authUser.role}
              />
            ))}
        </main>
      </div>
    </div>
  );
};

export default App;
