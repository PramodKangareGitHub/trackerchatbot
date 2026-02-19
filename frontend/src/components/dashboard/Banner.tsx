import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BANNER_STORAGE_KEY,
  BannerConfig,
  BannerValueCount,
  fetchValueCounts,
  formatDatasetName,
  readStoredBannerConfigs,
} from "./bannerUtils";

type BannerProps = {
  authToken?: string | null;
  dashboardId?: string | null;
  authUserRole?: string | null;
};

type DatasetMeta = {
  id: string;
  original_file_name?: string;
  table_name: string;
};

type DashboardMeta = {
  id: string;
  name: string;
};

type BannerGroup = {
  config: BannerConfig;
  datasetName: string;
  counts: BannerValueCount[];
  error?: string;
};

const accentPalette = [
  {
    bg: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white dark:from-emerald-500/20 dark:via-slate-900 dark:to-slate-900",
    border: "border-emerald-200/70 dark:border-emerald-500/40",
    text: "text-emerald-900 dark:text-emerald-50",
  },
  {
    bg: "bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-white dark:from-sky-500/20 dark:via-slate-900 dark:to-slate-900",
    border: "border-sky-200/70 dark:border-sky-500/40",
    text: "text-sky-900 dark:text-sky-50",
  },
  {
    bg: "bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white dark:from-indigo-500/20 dark:via-slate-900 dark:to-slate-900",
    border: "border-indigo-200/70 dark:border-indigo-500/40",
    text: "text-indigo-900 dark:text-indigo-50",
  },
  {
    bg: "bg-gradient-to-br from-amber-400/15 via-amber-400/8 to-white dark:from-amber-400/25 dark:via-slate-900 dark:to-slate-900",
    border: "border-amber-200/70 dark:border-amber-400/50",
    text: "text-amber-900 dark:text-amber-50",
  },
];

const BANNER_PULSE_STYLE_ID = "banner-dot-pulse-style";

const Banner: React.FC<BannerProps> = ({
  authToken,
  dashboardId,
  authUserRole,
}) => {
  const [groups, setGroups] = useState<BannerGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<DashboardMeta[]>([]);
  const [highlightedKeys, setHighlightedKeys] = useState<string[]>([]);
  const prevCountsRef = useRef<Map<string, number>>(new Map());

  const apiBase = useMemo(
    () => import.meta.env.VITE_API_BASE || "http://localhost:8000",
    []
  );

  const userRole = (authUserRole || "").toLowerCase();
  const isAdmin = userRole === "admin";

  const allowedDashboardIds = useMemo(
    () => new Set(dashboards.map((d) => d.id)),
    [dashboards]
  );

  const filteredGroups = useMemo(
    () =>
      groups.filter((g) => {
        const targetDashboardId = g.config.dashboard_id;
        const cfgRole = (g.config.role || "").toLowerCase();

        // Non-admins should only see banners tied to dashboards they can access.
        if (!isAdmin && targetDashboardId) {
          if (
            allowedDashboardIds.size &&
            !allowedDashboardIds.has(targetDashboardId)
          ) {
            return false;
          }
        }

        // Non-admins should only see banners that match their role (especially for Home).
        if (!isAdmin) {
          if (cfgRole && cfgRole !== userRole) return false;
          // If role not set, restrict Home to current role to avoid cross-role leakage.
          if (!cfgRole && (targetDashboardId || "home") === "home") {
            return false;
          }
        }

        // When a specific dashboard tab is active, show only banners for that dashboard.
        return dashboardId ? targetDashboardId === dashboardId : true;
      }),
    [allowedDashboardIds, dashboardId, groups, isAdmin, userRole]
  );

  useEffect(() => {
    if (document.getElementById(BANNER_PULSE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = BANNER_PULSE_STYLE_ID;
    style.textContent =
      "@keyframes banner-dot-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(0.7); } }";
    document.head.appendChild(style);
  }, []);

  const loadBanners = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError(null);
    try {
      const configs = readStoredBannerConfigs();
      if (!configs.length) {
        setGroups([]);
        setError(
          "No banners configured yet. Add banners from the Admin panel."
        );
        return;
      }

      const headers = { Authorization: `Bearer ${authToken}` };
      const datasetsRes = await fetch(`${apiBase}/api/datasets`, { headers });
      if (!datasetsRes.ok) {
        const body = await datasetsRes.json().catch(() => ({}));
        throw new Error(
          body.detail || datasetsRes.statusText || "Failed to load datasets"
        );
      }
      const datasets: DatasetMeta[] = await datasetsRes.json();
      const datasetMap = new Map(datasets.map((d) => [d.id, d] as const));

      const dashboardsRes = await fetch(`${apiBase}/api/admin/dashboards`, {
        headers,
      });
      if (!dashboardsRes.ok) {
        const body = await dashboardsRes.json().catch(() => ({}));
        throw new Error(
          body.detail || dashboardsRes.statusText || "Failed to load dashboards"
        );
      }
      const dashboardsData: { dashboards: DashboardMeta[] } =
        await dashboardsRes.json();
      const dashboardList = dashboardsData.dashboards || [];
      setDashboards(dashboardList);
      const dashboardMap = new Map(
        dashboardList.map((d) => [d.id, d] as const)
      );

      const results: BannerGroup[] = [];
      const changedKeys: string[] = [];
      const nextCounts = new Map<string, number>();

      for (const cfg of configs) {
        const ds = datasetMap.get(cfg.dataset_id);
        const datasetName = ds
          ? formatDatasetName(ds.original_file_name || ds.table_name || "")
          : cfg.dataset_id;

        const dash = cfg.dashboard_id
          ? dashboardMap.get(cfg.dashboard_id)
          : undefined;
        const dashboardName = dash?.name || "Unassigned";

        if (!ds) {
          results.push({
            config: cfg,
            datasetName,
            counts: [],
            error: "Dataset not found",
          });
          continue;
        }

        try {
          let counts = await fetchValueCounts({
            apiBase,
            authToken,
            datasetId: cfg.dataset_id,
            column: cfg.column,
            allowedValues: cfg.values,
          });

          // If specific values are configured, ensure they appear even when absent in data.
          if (cfg.values && cfg.values.length) {
            const existing = new Set(counts.map((c) => c.value));
            cfg.values.forEach((val) => {
              if (!existing.has(val)) {
                counts = [...counts, { value: val, count: 0 }];
              }
            });
          }

          const hasYes = counts.some(
            (entry) => entry.value.trim().toLowerCase() === "yes"
          );
          const hasNo = counts.some(
            (entry) => entry.value.trim().toLowerCase() === "no"
          );
          if (!cfg.values || !cfg.values.length) {
            if (hasYes && !hasNo) {
              counts = [...counts, { value: "No", count: 0 }];
            } else if (hasNo && !hasYes) {
              counts = [...counts, { value: "Yes", count: 0 }];
            }
          }

          counts.sort((a, b) => {
            if (a.count !== b.count) return b.count - a.count;
            return a.value.localeCompare(b.value);
          });

          counts.forEach((item) => {
            const key = `${cfg.id}::${item.value}`;
            nextCounts.set(key, item.count);
            const prev = prevCountsRef.current.get(key);
            if (prev !== undefined && prev !== item.count) {
              changedKeys.push(key);
            }
          });

          results.push({
            config: { ...cfg, dashboard_id: cfg.dashboard_id },
            datasetName,
            counts,
          });
        } catch (err) {
          results.push({
            config: { ...cfg, dashboard_id: cfg.dashboard_id },
            datasetName,
            counts: [],
            error:
              err instanceof Error
                ? err.message
                : "Failed to load banner counts",
          });
        }
      }

      prevCountsRef.current = nextCounts;

      if (changedKeys.length) {
        setHighlightedKeys((prev) => {
          const next = new Set(prev);
          changedKeys.forEach((k) => next.add(k));
          return Array.from(next);
        });

        changedKeys.forEach((key) => {
          window.setTimeout(() => {
            setHighlightedKeys((prev) => prev.filter((k) => k !== key));
          }, 4000);
        });
      }

      setGroups(results);
      if (!results.some((r) => r.counts.length)) {
        setError("No banner results available.");
      }
    } catch (err) {
      setGroups([]);
      setError(err instanceof Error ? err.message : "Failed to load banners");
    } finally {
      setLoading(false);
    }
  }, [apiBase, authToken]);

  useEffect(() => {
    if (!authToken) return;
    loadBanners();
  }, [authToken, loadBanners]);

  useEffect(() => {
    if (!authToken) return;
    const id = window.setInterval(() => {
      loadBanners();
    }, 20000);
    return () => {
      clearInterval(id);
    };
  }, [authToken, loadBanners]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === BANNER_STORAGE_KEY) {
        loadBanners();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadBanners]);

  useEffect(() => {
    const onChange = () => loadBanners();
    window.addEventListener(
      "banner-configs-changed",
      onChange as EventListener
    );
    return () =>
      window.removeEventListener(
        "banner-configs-changed",
        onChange as EventListener
      );
  }, [loadBanners]);

  if (!authToken) return null;
  if (dashboardId && !filteredGroups.length) return null;

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 backdrop-blur dark:bg-white/5 dark:text-slate-100 dark:ring-slate-600">
            <span
              aria-hidden
              className="h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-lg ring-2 ring-emerald-200/60 dark:ring-emerald-500/40"
              style={{
                animation: "banner-dot-pulse 1.2s ease-in-out infinite",
              }}
            />
            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Live
            </span>
          </div>

          {!filteredGroups.length && !loading && !error && !dashboardId && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              No banners configured yet.
            </div>
          )}

          {filteredGroups.flatMap((group, groupIdx) =>
            group.counts.map((item, itemIdx) => {
              const itemKey = `${group.config.id}::${item.value}`;
              const isHighlighted = highlightedKeys.includes(itemKey);
              const accent =
                accentPalette[(groupIdx + itemIdx) % accentPalette.length];
              const labelText =
                group.config.label || group.config.column || item.value;
              return (
                <div
                  key={`${group.config.id}-${item.value}-${itemIdx}`}
                  className={`flex min-w-[140px] max-w-[220px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl border px-3 py-2.5 text-center shadow-sm ${accent.bg} ${
                    isHighlighted
                      ? "border-amber-700 ring-2 ring-amber-500/70"
                      : accent.border
                  } ${accent.text}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {labelText}
                  </span>
                  <span className="text-sm font-bold leading-tight whitespace-nowrap">
                    : {item.count}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          {loading && (
            <span className="text-slate-500 dark:text-slate-300">
              Refreshing...
            </span>
          )}
          <button
            type="button"
            onClick={loadBanners}
            className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </section>
  );
};

export default Banner;
