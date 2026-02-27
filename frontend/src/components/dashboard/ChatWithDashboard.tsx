import { useEffect, useMemo, useState } from "react";
import ChatWindow from "../ChatWindow";
import DashboardChartPreview, {
  DashboardChartConfig,
} from "./DashboardChartPreview";
import Banner from "./Banner";
import ReportModal from "./ReportModal";

type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
};

export type ChatSectionProps = {
  authToken: string | null;
  authUserRole?: string | null;
  showSql?: boolean;
  hideChat?: boolean;
};

const ChatWithDashboard = ({
  authToken,
  authUserRole,
  showSql,
  hideChat = false,
}: ChatSectionProps) => {
  const [widgetOptions, setWidgetOptions] = useState<
    {
      id: string;
      title: string;
      widget_type?: string | null;
      config?: any;
      roles?: string[];
    }[]
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
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<string[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportColumns, setReportColumns] = useState<string[]>([]);
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const loadDashboards = async () => {
      if (!authToken) {
        setDashboards([]);
        setSelectedDashboardId(null);
        return;
      }
      setDashboardsLoading(true);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/admin/dashboards`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load dashboards"
          );
        }
        const data = await res.json();
        const list = Array.isArray(data?.dashboards) ? data.dashboards : [];
        setDashboards(list);
        if (!list.length) {
          setSelectedDashboardId(null);
        } else {
          const stillValid = list.some((d) => d.id === selectedDashboardId);
          if (!stillValid) setSelectedDashboardId(list[0].id);
        }
      } catch (err) {
        setWidgetError(err instanceof Error ? err.message : String(err));
      } finally {
        setDashboardsLoading(false);
      }
    };

    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!dashboards.length) {
      setSelectedDashboardId(null);
      return;
    }
    if (
      selectedDashboardId &&
      dashboards.some((d) => d.id === selectedDashboardId)
    ) {
      return;
    }
    setSelectedDashboardId(dashboards[0].id);
  }, [dashboards, selectedDashboardId]);

  useEffect(() => {
    const load = async () => {
      if (!authToken || !selectedDashboardId) {
        setWidgetOptions([]);
        setSelectedWidgetIds(["all"]);
        return;
      }
      setWidgetLoading(true);
      setWidgetError(null);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(
          `${apiBase}/api/admin/dashboard-config?dashboard_id=${encodeURIComponent(selectedDashboardId)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
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
        setSelectedWidgetIds(["all"]);
        setCollapsedWidgetIds([]);
      } catch (err) {
        setWidgetError(err instanceof Error ? err.message : String(err));
      } finally {
        setWidgetLoading(false);
      }
    };

    load();
  }, [authToken, authUserRole, selectedDashboardId]);

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
    const filterBy = cfg.filter_by || "";
    const filterValues: string[] = cfg.filter_values || [];
    const baseColumns = cfg.fields?.length ? cfg.fields : datasetCols;
    const columns = (baseColumns || []).filter((c: string) => c);

    const normalize = (col: string) =>
      col.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const isAgeing = (col: string) => normalize(col) === "ageing_as_on_today";
    const isDateCol = (col: string) =>
      normalize(col) === "jp_posting_date_to_hcl";
    const quarterMatch = (v: string) => {
      const m = v.match(/^Q([1-4])(?:\s+(\d{4}))?$/i);
      if (!m) return null;
      const q = Number(m[1]);
      const yr = m[2] ? Number(m[2]) : null;
      return { q, year: yr };
    };
    const hasQuarterVal = (values: string[]) =>
      values.some((v) => Boolean(quarterMatch(v)));
    const hasQuarterValWithYear = (values: string[]) =>
      values.some((v) => Boolean(quarterMatch(v)?.year));
    const hasDayRangeVal = (values: string[]) =>
      values.some((v) => /^\d+\s*-\s*\d+$/.test(v) || /^\d+\+$/.test(v));

    const bucketAgeLabel = (val: unknown) => {
      const num = Number(val);
      if (!Number.isFinite(num)) {
        return val === null || val === undefined ? "(blank)" : String(val);
      }
      if (num <= 30) return "0-30";
      if (num >= 31 && num <= 60) return "31-60";
      if (num >= 61 && num <= 90) return "61-90";
      return "90+";
    };

    const matchesAgeRange = (num: number, label: string) => {
      const trimmed = label.trim();
      const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const low = Number(rangeMatch[1]);
        const high = Number(rangeMatch[2]);
        if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
        return num >= low && num <= high;
      }
      if (/^(90\+)$/.test(trimmed)) {
        return num >= 90;
      }
      return String(num) === trimmed;
    };

    const toQuarterLabel = (val: unknown, withYear = false) => {
      if (val === null || val === undefined) return "(blank)";
      const parsed = new Date(String(val));
      if (Number.isNaN(parsed.getTime())) return String(val);
      // Use UTC to avoid timezone shifting year/month
      const q = Math.floor(parsed.getUTCMonth() / 3) + 1;
      const year = parsed.getUTCFullYear();
      if (q < 1 || q > 4 || !Number.isFinite(year)) return String(val);
      return withYear ? `Q${q} ${year}` : `Q${q}`;
    };

    const toDayRangeLabel = (val: unknown) => {
      if (val === null || val === undefined) return "(blank)";
      const parsed = new Date(String(val));
      if (Number.isNaN(parsed.getTime())) return String(val);
      const diffMs = Date.now() - parsed.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (!Number.isFinite(diffDays)) return String(val);
      if (diffDays <= 30) return "0-30";
      if (diffDays <= 60) return "31-60";
      if (diffDays <= 90) return "61-90";
      return "90+";
    };

    const toLabelFor = (
      col: string,
      selectedValues: string[],
      val: unknown
    ) => {
      if (isAgeing(col)) return bucketAgeLabel(val);
      if (isDateCol(col)) {
        const hasQuarter = hasQuarterVal(selectedValues);
        const hasQuarterYear = hasQuarterValWithYear(selectedValues);
        const hasDayRanges = hasDayRangeVal(selectedValues);
        const quarterLabel = toQuarterLabel(val, false);
        const quarterLabelYear = toQuarterLabel(val, true);
        const dayLabel = toDayRangeLabel(val);
        if (hasDayRanges && hasQuarter) {
          if (selectedValues.includes(dayLabel)) return dayLabel;
          if (hasQuarterYear && selectedValues.includes(quarterLabelYear))
            return quarterLabelYear;
          if (selectedValues.includes(quarterLabel)) return quarterLabel;
          if (hasQuarterYear) return quarterLabelYear;
          return dayLabel;
        }
        if (hasDayRanges) return dayLabel;
        if (hasQuarter) {
          if (hasQuarterYear) return quarterLabelYear;
          return quarterLabel;
        }
      }
      return val === null || val === undefined ? "(blank)" : String(val);
    };

    const matchesSelection = (
      col: string,
      selectedValues: string[],
      rowVal: unknown
    ) => {
      if (!selectedValues.length) return true;
      const norm = (v: unknown) =>
        typeof v === "string"
          ? v.trim().toLowerCase()
          : String(v ?? "")
              .trim()
              .toLowerCase();
      if (isAgeing(col)) {
        const num = Number(rowVal);
        if (!Number.isFinite(num)) return false;
        return selectedValues.some((gv) => matchesAgeRange(num, gv));
      }
      if (isDateCol(col)) {
        const quarterLabel = toQuarterLabel(rowVal, false);
        const quarterLabelYear = toQuarterLabel(rowVal, true);
        const dayLabel = toDayRangeLabel(rowVal);
        const rawLabel =
          rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
        return selectedValues.some((v) => {
          const nv = norm(v);
          return (
            nv === norm(quarterLabel) ||
            nv === norm(quarterLabelYear) ||
            nv === norm(dayLabel) ||
            nv === norm(rawLabel)
          );
        });
      }
      const label = toLabelFor(col, selectedValues, rowVal);
      return selectedValues.some((v) => norm(v) === norm(label));
    };

    const rowsAfterFilter = filterBy
      ? rows.filter((row) =>
          matchesSelection(filterBy, filterValues, row[filterBy])
        )
      : rows;

    if (groupBy) {
      const filteredRows = rowsAfterFilter.filter((row) =>
        matchesSelection(groupBy, groupValues, row[groupBy])
      );

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
        const groupLabel = toLabelFor(groupBy, groupValues, groupKeyRaw);

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

    const rowsOut = rowsAfterFilter.slice(0, 50).map((row) => {
      const out: Record<string, unknown> = {};
      columns.forEach((c) => {
        out[c] = row[c];
      });
      return out;
    });
    return { columns, rows: rowsOut };
  };

  const buildFilterQuery = (cfg: any) => {
    const filterBy = cfg.filter_by || "";
    const filterValues: string[] = cfg.filter_values || [];
    const groupBy = cfg.group_by || "";
    const groupValues: string[] = cfg.group_by_values || [];
    if (!filterBy || !filterValues.length) return "";
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const isDateBucket = normalize(filterBy) === "jp_posting_date_to_hcl";
    const quarterPattern = /^Q[1-4](?:\s+\d{4})?$/i;
    const isQuarterVals = filterValues.every((v) => quarterPattern.test(v));
    const isDayRangeVals = filterValues.every(
      (v) => /^\d+\s*-\s*\d+$/.test(v) || /^\d+\+$/.test(v)
    );
    // Derived buckets: don't send to backend when explicitly filtering on date bucket
    if (isDateBucket && (isQuarterVals || isDayRangeVals)) return "";

    const params = new URLSearchParams();
    let targetFilterBy = filterBy;
    let targetValues = filterValues;

    // If no server-side filter is set but group_by is a date bucket with quarter selections, send a derived filter
    if (
      !filterBy &&
      groupBy &&
      normalize(groupBy) === "jp_posting_date_to_hcl"
    ) {
      const isGroupQuarterVals =
        groupValues.length > 0 &&
        groupValues.every((v) => quarterPattern.test(v));
      if (isGroupQuarterVals) {
        targetFilterBy = groupBy;
        targetValues = groupValues.map((v) => {
          const parts = v.trim().split(/\s+/);
          const qpart = parts[0] || v;
          const year = parts[1];
          return year
            ? `quarter:${qpart.replace(/^Q/i, "Q")} ${year}`
            : `quarter:${qpart.replace(/^Q/i, "Q")}`;
        });
      }
    }

    params.set("filter_by", targetFilterBy);
    targetValues.forEach((v) => params.append("filter_values", v));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
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
          const filterQs = buildFilterQuery(cfg);
          const limit = cfg.group_by ? 2000 : 50;
          const res = await fetch(
            `${apiBase}/api/admin/datasets/${datasetId}/records?limit=${limit}${filterQs}`,
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

  const toggleWidgetCollapse = (id: string) => {
    setCollapsedWidgetIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!showReportModal) return;
    const controller = new AbortController();
    const loadReport = async () => {
      if (!authToken || !targetWidgets.length) {
        setReportColumns([]);
        setReportRows([]);
        return;
      }
      setReportLoading(true);
      setReportError(null);
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const colSet = new Set<string>();
      const rowsOut: Record<string, unknown>[] = [];

      for (const widget of targetWidgets) {
        const cfg = widget.config || {};
        const datasetId = cfg.dataset_id;
        if (!datasetId) continue;
        try {
          // For full-report export, always fetch unfiltered data so users can pivot freely
          const res = await fetch(
            `${apiBase}/api/admin/datasets/${datasetId}/records`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
              signal: controller.signal,
            }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              body.detail || res.statusText || "Failed to load report data"
            );
          }
          const data = await res.json();
          const datasetCols: string[] = data?.columns || [];
          const rows: Record<string, unknown>[] = data?.rows || [];
          datasetCols.forEach((c) => colSet.add(c));
          rows.forEach((row) => {
            const out: Record<string, unknown> = {};
            datasetCols.forEach((c) => {
              out[c] = row[c] ?? "";
            });
            rowsOut.push(out);
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setReportError(err instanceof Error ? err.message : String(err));
        }
      }

      setReportColumns(Array.from(colSet));
      setReportRows(rowsOut);
      setReportLoading(false);
    };

    loadReport();

    return () => controller.abort();
  }, [authToken, showReportModal, targetWidgets]);

  const layoutClass = hideChat
    ? "grid gap-4"
    : "grid gap-4 lg:grid-cols-[minmax(260px,26%),1fr]";

  return (
    <div className="space-y-3">
      {selectedDashboardId && (
        <Banner
          authToken={authToken}
          dashboardId={selectedDashboardId}
          authUserRole={authUserRole}
        />
      )}

      <div className={layoutClass}>
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white p-5 shadow-lg dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <div className="mt-4 space-y-3">
            <div
              className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-1 dark:border-slate-700"
              role="tablist"
            >
              {dashboardsLoading ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Loading dashboards...
                </span>
              ) : dashboards.length ? (
                dashboards.map((dash) => {
                  const active = dash.id === selectedDashboardId;
                  return (
                    <button
                      key={dash.id}
                      type="button"
                      onClick={() => setSelectedDashboardId(dash.id)}
                      role="tab"
                      aria-selected={active}
                      className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                        active
                          ? "border-b-2 border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-100"
                          : "border-b-2 border-transparent text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                      }`}
                    >
                      {dash.name}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  No dashboards yet. Ask an admin to create one.
                </span>
              )}
            </div>

            {widgetOptions.length > 0 && (
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-[260px] max-w-full">
                  <button
                    type="button"
                    onClick={() => setWidgetPickerOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  >
                    <span>
                      {selectedDashboardId
                        ? widgetSummary
                        : "Select a dashboard"}
                    </span>
                    <span aria-hidden className="text-slate-400">
                      ▾
                    </span>
                  </button>
                  {widgetPickerOpen && (
                    <div className="absolute z-30 mt-2 w-[260px] rounded-lg border border-slate-300 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
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
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
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
                {/* <div className="flex-1 flex justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-sky-600 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
                  >
                    Received new Job Posting?
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-400 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"
                  >
                    Update Job Posting
                  </button>
                </div> */}
              </div>
            )}
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {previewItems.map((item) => {
                const isCollapsed = collapsedWidgetIds.includes(item.widgetId);
                return (
                  <div
                    key={item.widgetId}
                    className="flex h-[420px] flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleWidgetCollapse(item.widgetId)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          aria-label={
                            isCollapsed ? "Expand widget" : "Collapse widget"
                          }
                        >
                          {isCollapsed ? "Expand" : "Collapse"}
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="flex h-full flex-col space-y-3">
                        {item.widgetType === "chart" ? (
                          <DashboardChartPreview
                            title={item.title}
                            config={item.config as DashboardChartConfig}
                            columns={item.columns}
                            rows={item.rows}
                          />
                        ) : (
                          <div className="h-full overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 shadow-inner dark:border-slate-700">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100">
                                <tr>
                                  {item.columns.map((c) => (
                                    <th
                                      key={c}
                                      className="sticky top-0 z-10 whitespace-nowrap bg-slate-200/95 px-3 py-2 font-semibold backdrop-blur dark:bg-slate-700/95"
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
                                    className={
                                      idx % 2 === 0
                                        ? "bg-white dark:bg-slate-900"
                                        : "bg-slate-50 dark:bg-slate-800"
                                    }
                                  >
                                    {item.columns.map((c) => (
                                      <td
                                        key={c}
                                        className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-slate-200"
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
                                      className="px-3 py-4 text-center text-slate-500 dark:text-slate-400"
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
                    )}
                  </div>
                );
              })}
            </div>
            {!!previewItems.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 underline-offset-4 hover:text-sky-700 hover:underline dark:text-sky-300 dark:hover:text-sky-200"
                >
                  <span aria-hidden>+</span>
                  More Details
                </button>
                {reportLoading && (
                  <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Loading full data…
                  </p>
                )}
                {reportError && (
                  <p className="pt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    {reportError}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {!hideChat && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <ChatWindow authToken={authToken} showSql={showSql} />
          </section>
        )}
      </div>

      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        columns={reportColumns}
        rows={reportRows}
      />
    </div>
  );
};

export default ChatWithDashboard;
