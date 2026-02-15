import { useEffect, useMemo, useState } from "react";
import ChatWindow from "../ChatWindow";
import DashboardChartPreview, {
  DashboardChartConfig,
} from "./DashboardChartPreview";
import ReportModal from "./ReportModal";

export type ChatSectionProps = {
  authToken: string | null;
  authUserRole?: string | null;
  showSql?: boolean;
};

const ChatWithDashboard = ({
  authToken,
  authUserRole,
  showSql,
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
  }, [authToken, authUserRole]);

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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,26%),1fr]">
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white p-5 shadow-lg dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="flex items-center justify-start gap-2 pb-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Dashboard
          </h3>
        </div>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setWidgetPickerOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-400 focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            >
              <span>{widgetSummary}</span>
              <span aria-hidden className="text-slate-400">
                ▾
              </span>
            </button>
            {widgetPickerOpen && (
              <div className="absolute z-10 mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
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
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                      collapsedWidgetIds.includes(item.widgetId)
                        ? "Expand widget"
                        : "Collapse widget"
                    }
                  >
                    <span aria-hidden>
                      {collapsedWidgetIds.includes(item.widgetId) ? "+" : "-"}
                    </span>
                  </button>
                </div>
              </div>
              {!collapsedWidgetIds.includes(item.widgetId) && (
                <>
                  {item.widgetType === "chart" && item.config ? (
                    <DashboardChartPreview
                      title={item.title}
                      config={item.config as DashboardChartConfig}
                      columns={item.columns}
                      rows={item.rows}
                    />
                  ) : (
                    <div className="overflow-auto rounded-lg border border-slate-200 shadow-inner dark:border-slate-700">
                      <table className="min-w-full text-left text-xs">
                        <thead className="bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100">
                          <tr>
                            {item.columns.map((c) => (
                              <th
                                key={c}
                                className="whitespace-nowrap px-3 py-2 font-semibold"
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
                </>
              )}
            </div>
          ))}
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
      <ChatWindow authToken={authToken} showSql={showSql} />
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
