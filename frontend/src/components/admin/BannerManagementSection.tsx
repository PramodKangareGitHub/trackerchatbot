import { useEffect, useMemo, useState } from "react";
import type { Dashboard, Dataset, UserRole } from "./types";
import {
  TABLE_TOTAL_COLUMN,
  type BannerConfig,
  type BannerValueCount,
  type BannerCountsResult,
  formatDatasetName,
} from "../dashboard/bannerUtils";

type BannerManagementSectionProps = {
  dashboards: Dashboard[];
  selectedDashboardId: string | null;
  datasets: Dataset[];
  bannerConfigs: BannerConfig[];
  onSaveBanner: (config: BannerConfig) => void;
  onDeleteBanner: (id: string) => void;
  loadColumns: (datasetId: string) => Promise<string[]>;
  loadColumnValues: (datasetId: string, column: string) => Promise<string[]>;
  loadValueCounts: (
    datasetId: string,
    column: string,
    selectedValues?: string[],
    operator?: string,
    filters?: { table?: string; field: string; values: string[]; op: string }[]
  ) => Promise<BannerCountsResult>;
  userRole: UserRole;
};

type BannerDraft = {
  id: string | null;
  dashboardId: string;
  datasetId: string;
  column: string;
  label: string;
  values: string[];
  op: string;
  filters: {
    id: string;
    table?: string;
    field: string;
    values: string[];
    op: string;
  }[];
  role: string;
};

const BannerManagementSection = ({
  datasets,
  dashboards,
  selectedDashboardId,
  bannerConfigs,
  onSaveBanner,
  onDeleteBanner,
  loadColumns,
  loadColumnValues,
  loadValueCounts,
  userRole,
}: BannerManagementSectionProps) => {
  const isAdmin = userRole === "admin";
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<BannerDraft>({
    id: null,
    dashboardId: "",
    datasetId: "",
    column: "",
    label: "",
    values: [],
    op: "in",
    filters: [],
    role: userRole,
  });
  const [valueOptions, setValueOptions] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [filterValueOptions, setFilterValueOptions] = useState<
    Record<string, string[]>
  >({});
  const [filterValueLoading, setFilterValueLoading] = useState<
    Record<string, boolean>
  >({});
  const [columnOptions, setColumnOptions] = useState<Record<string, string[]>>(
    {}
  );
  const [previewCounts, setPreviewCounts] = useState<BannerValueCount[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const datasetLookup = useMemo(() => {
    const map = new Map<string, Dataset>();
    datasets.forEach((ds) => {
      if (ds.id) map.set(ds.id, ds);
      if (ds.table_name) map.set(ds.table_name, ds);
    });
    return map;
  }, [datasets]);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === draft.datasetId) || null,
    [datasets, draft.datasetId]
  );

  const allowedDashboards = useMemo(
    () => (isAdmin ? dashboards : dashboards.filter((d) => d.id === "home")),
    [dashboards, isAdmin]
  );

  const visibleBannerConfigs = useMemo(
    () =>
      isAdmin
        ? bannerConfigs
        : bannerConfigs.filter(
            (cfg) =>
              (cfg.dashboard_id || "home") === "home" &&
              (cfg.role || userRole) === userRole
          ),
    [bannerConfigs, isAdmin, userRole]
  );

  useEffect(() => {
    if (!draft.dashboardId) {
      resetDraft(
        allowedDashboards[0]?.id ||
          dashboards[0]?.id ||
          selectedDashboardId ||
          "home",
        datasets[0]?.id
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDashboards, dashboards, datasets, selectedDashboardId]);

  // Ensure dataset/column are set once datasets arrive so the table list renders.
  useEffect(() => {
    if (!datasets.length) return;
    const currentDatasetId = draft.datasetId || datasets[0].id;
    const currentColumn =
      draft.column ||
      datasets.find((d) => d.id === currentDatasetId)?.columns[0] ||
      datasets[0].columns[0] ||
      "";

    if (draft.datasetId && draft.column) return;

    setDraft((prev) => ({
      ...prev,
      datasetId: currentDatasetId,
      column: currentColumn,
      label: prev.label || currentColumn,
    }));
  }, [datasets, draft.datasetId, draft.column]);

  // Lazy-load columns for the selected dataset when missing so dropdown populates.
  useEffect(() => {
    if (!draft.datasetId) return;
    const ds = datasets.find((d) => d.id === draft.datasetId);
    if (ds && ds.columns && ds.columns.length) return;
    loadColumns(draft.datasetId).catch(() => {
      /* ignore errors; dropdown will stay empty */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.datasetId, datasets]);

  const resetDraft = (targetDashboardId?: string, targetDatasetId?: string) => {
    const nextDashboardId =
      targetDashboardId ||
      selectedDashboardId ||
      allowedDashboards[0]?.id ||
      dashboards[0]?.id ||
      "home";
    const nextDatasetId = targetDatasetId || datasets[0]?.id || "";
    const nextColumn =
      datasets.find((d) => d.id === nextDatasetId)?.columns[0] || "";
    setDraft({
      id: null,
      dashboardId: nextDashboardId,
      datasetId: nextDatasetId,
      column: nextColumn,
      label: nextColumn,
      values: [],
      op: "in",
      filters: [],
      role: userRole,
    });
    setValueOptions([]);
    setFilterValueOptions({});
    setPreviewCounts([]);
    setModalError(null);
  };

  const openCreate = () => {
    resetDraft();
    setShowModal(true);
  };

  const openEdit = (config: BannerConfig) => {
    const safeDashboardId = isAdmin
      ? config.dashboard_id || selectedDashboardId || ""
      : "home";
    setDraft({
      id: config.id,
      dashboardId: safeDashboardId,
      datasetId: config.dataset_id,
      column: config.column,
      label: config.label || config.column,
      values: config.values || [],
      op: config.op || config.operator || "in",
      filters: (config.filters || []).map((f) => ({
        id: crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
        table: f.table,
        field: f.field,
        values: f.values || [],
        op: f.op || f.operator || "in",
      })),
      role: config.role || userRole,
    });
    setValueOptions([]);
    setPreviewCounts([]);
    setModalError(null);
    setShowModal(true);
  };

  useEffect(() => {
    if (!showModal) return;
    if (!draft.datasetId || !draft.column) return;

    setValuesLoading(true);
    loadColumnValues(draft.datasetId, draft.column)
      .then((values) => {
        const hasYes = values.some((v) => v.trim().toLowerCase() === "yes");
        const hasNo = values.some((v) => v.trim().toLowerCase() === "no");
        const padded =
          hasYes && !hasNo
            ? [...values, "No"]
            : hasNo && !hasYes
              ? [...values, "Yes"]
              : values;

        const merged = Array.from(
          new Set([...(draft.values || []), ...padded])
        );

        setValueOptions(merged);
      })
      .catch((err) =>
        setModalError(
          err instanceof Error ? err.message : "Failed to load column values"
        )
      )
      .finally(() => setValuesLoading(false));

    // Load options for existing extra filters
    draft.filters.forEach((f) => {
      if (f.field) loadFilterValues(f.table || draft.datasetId, f.field);
    });
  }, [
    showModal,
    draft.datasetId,
    draft.column,
    draft.filters,
    loadColumnValues,
  ]);

  const toggleValue = (val: string) => {
    setDraft((prev) => {
      const current = prev.values || [];
      const next = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];
      return { ...prev, values: next };
    });
  };

  const loadFilterValues = async (tableId: string, column: string) => {
    if (!column || !tableId) return;
    const key = `${tableId}::${column}`;
    setFilterValueLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const values = await loadColumnValues(tableId, column);
      setFilterValueOptions((prev) => ({ ...prev, [key]: values || [] }));
    } catch {
      setFilterValueOptions((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setFilterValueLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handlePreview = async () => {
    if (!draft.datasetId || !draft.column) {
      setModalError("Select a dataset and column first.");
      return;
    }
    setPreviewLoading(true);
    setModalError(null);
    try {
      const isTableTotal = draft.column === TABLE_TOTAL_COLUMN;

      const { counts: countsIn, total } = await loadValueCounts(
        draft.datasetId,
        draft.column,
        isTableTotal ? [] : draft.values,
        isTableTotal ? undefined : draft.op,
        draft.filters.map((f) => ({
          table: f.table,
          field: f.field,
          values: f.values,
          op: f.op,
        }))
      );

      let counts = [...countsIn];

      if (!isTableTotal) {
        // Ensure explicitly selected values are present even if missing in data.
        if (draft.values.length) {
          const existing = new Set(counts.map((c) => c.value));
          draft.values.forEach((val) => {
            if (!existing.has(val)) {
              counts = [...counts, { value: val, count: 0 }];
            }
          });
        }

        if (!draft.values.length) {
          const hasYes = counts.some(
            (entry) => entry.value.trim().toLowerCase() === "yes"
          );
          const hasNo = counts.some(
            (entry) => entry.value.trim().toLowerCase() === "no"
          );
          if (hasYes && !hasNo) {
            counts = [...counts, { value: "No", count: 0 }];
          } else if (hasNo && !hasYes) {
            counts = [...counts, { value: "Yes", count: 0 }];
          }
        }
      }

      counts.sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      });

      const selected = new Set((draft.values || []).map((v) => v.trim()));
      const aggregatedCount = isTableTotal
        ? total
        : selected.size
          ? counts.reduce(
              (sum, entry) =>
                selected.has(entry.value) ? sum + entry.count : sum,
              0
            )
          : total;

      const combinedLabel = isTableTotal
        ? draft.label.trim() || "Total"
        : selected.size
          ? Array.from(selected).join(" OR ")
          : draft.label.trim() || draft.column;

      setPreviewCounts([{ value: combinedLabel, count: aggregatedCount }]);
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "Failed to load preview counts"
      );
      setPreviewCounts([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = () => {
    if (!draft.dashboardId || !draft.datasetId || !draft.column) {
      setModalError("Dashboard, dataset, and column are required.");
      return;
    }
    const id =
      draft.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `banner-${Date.now()}`);
    const targetDashboardId = isAdmin
      ? draft.dashboardId
      : draft.dashboardId || "home";
    const config: BannerConfig = {
      id,
      dashboard_id: targetDashboardId,
      dataset_id: draft.datasetId,
      column: draft.column,
      label:
        draft.label.trim() ||
        (draft.column === TABLE_TOTAL_COLUMN ? "Total" : draft.column),
      values: draft.column === TABLE_TOTAL_COLUMN ? [] : draft.values,
      op: draft.column === TABLE_TOTAL_COLUMN ? "in" : draft.op,
      filters: draft.filters.map((f) => ({
        table: f.table,
        field: f.field,
        values: f.values,
        op: f.op,
      })),
      role: draft.role || userRole,
    };
    onSaveBanner(config);
    setShowModal(false);
  };

  const datasetLabel = (datasetId: string) => {
    const ds = datasets.find((d) => d.id === datasetId);
    if (!ds) return datasetId;
    return formatDatasetName(ds.original_file_name || ds.table_name || ds.id);
  };

  const dashboardLabel = (dashboardId: string) => {
    const dash = dashboards.find((d) => d.id === dashboardId);
    return dash?.name || "Select dashboard";
  };

  const columnsForDataset = selectedDataset?.columns || [];
  const columnsWithTotal = useMemo(
    () => [TABLE_TOTAL_COLUMN, ...columnsForDataset],
    [columnsForDataset]
  );

  const operatorOptions = [
    { label: "Is any of", value: "in" },
    { label: "Is not any of", value: "not_in" },
    { label: "Equals", value: "=" },
    { label: "Not equal", value: "!=" },
    { label: "Greater than", value: ">" },
    { label: "Greater or equal", value: ">=" },
    { label: "Less than", value: "<" },
    { label: "Less or equal", value: "<=" },
    { label: "Between", value: "between" },
    { label: "Contains", value: "contains" },
  ];

  const toggleFilterValue = (filterId: string, val: string) => {
    setDraft((prev) => {
      const filters = prev.filters.map((f) => {
        if (f.id !== filterId) return f;
        const checked = f.values.includes(val);
        const nextVals = checked
          ? f.values.filter((v) => v !== val)
          : [...f.values, val];
        return { ...f, values: nextVals };
      });
      return { ...prev, filters };
    });
  };

  const ensureColumns = async (tableId: string) => {
    if (!tableId) return [] as string[];
    if (columnOptions[tableId]) return columnOptions[tableId];
    const ds = datasets.find((d) => d.id === tableId);
    if (ds && ds.columns && ds.columns.length) {
      setColumnOptions((prev) => ({ ...prev, [tableId]: ds.columns }));
      return ds.columns;
    }
    try {
      const cols = await loadColumns(tableId);
      setColumnOptions((prev) => ({ ...prev, [tableId]: cols || [] }));
      return cols || [];
    } catch {
      setColumnOptions((prev) => ({ ...prev, [tableId]: [] }));
      return [];
    }
  };

  const updateFilterField = (
    filterId: string,
    field: string,
    tableId?: string
  ) => {
    setDraft((prev) => {
      const filters = prev.filters.map((f) =>
        f.id === filterId
          ? { ...f, field, values: [], table: tableId ?? f.table }
          : f
      );
      return { ...prev, filters };
    });
    if (tableId && field) {
      loadFilterValues(tableId, field);
    }
  };

  const updateFilterTable = async (filterId: string, tableId: string) => {
    const cols = await ensureColumns(tableId);
    const nextField = cols[0] || "";
    setDraft((prev) => {
      const filters = prev.filters.map((f) =>
        f.id === filterId
          ? { ...f, table: tableId, field: nextField, values: [] }
          : f
      );
      return { ...prev, filters };
    });
    if (nextField) {
      loadFilterValues(tableId, nextField);
    }
  };

  const updateFilterOp = (filterId: string, op: string) => {
    setDraft((prev) => {
      const filters = prev.filters.map((f) =>
        f.id === filterId ? { ...f, op } : f
      );
      return { ...prev, filters };
    });
  };

  const addFilterRow = () => {
    const baseTable = draft.datasetId;
    const nextField = columnsForDataset[0] || "";
    setDraft((prev) => ({
      ...prev,
      filters: [
        ...prev.filters,
        {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `f-${Date.now()}-${Math.random()}`,
          table: baseTable,
          field: nextField,
          values: [],
          op: "in",
        },
      ],
    }));
    if (baseTable && nextField) {
      loadFilterValues(baseTable, nextField);
    }
  };

  const removeFilterRow = (filterId: string) => {
    setDraft((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.id !== filterId),
    }));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Banner Management
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create banners that show VALUE : COUNT pills for a column.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          disabled={false}
        >
          Add Banner
        </button>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {!visibleBannerConfigs.length && (
          <p className="text-slate-500 dark:text-slate-400">
            No banners yet. Add one to display counts in the main view.
          </p>
        )}
        {visibleBannerConfigs.map((cfg) => (
          <div
            key={cfg.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
          >
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {cfg.label || cfg.column}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {dashboardLabel(cfg.dashboard_id || "")} ·{" "}
                {datasetLabel(cfg.dataset_id)} · {cfg.column}
                {cfg.values && cfg.values.length
                  ? ` · ${cfg.values.length} value${cfg.values.length === 1 ? "" : "s"}`
                  : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => openEdit(cfg)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDeleteBanner(cfg.id)}
                className="rounded-lg border border-rose-200 bg-white px-3 py-1 font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {draft.id ? "Edit banner" : "Create banner"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose dataset, column, and optional specific values.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Dashboard
                </label>
                <select
                  value={draft.dashboardId}
                  onChange={(e) => {
                    const nextDashboardId = isAdmin ? e.target.value : "home";
                    setDraft((prev) => ({
                      ...prev,
                      dashboardId: nextDashboardId,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  disabled={!isAdmin}
                >
                  {!allowedDashboards.length && <option>No dashboards</option>}
                  {allowedDashboards.map((dash) => (
                    <option key={dash.id} value={dash.id}>
                      {dash.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Label (optional)
                </label>
                <input
                  value={draft.label}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="Display label"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Filters (OR for values; additional filters are ANDed)
                  </label>
                  <button
                    type="button"
                    onClick={addFilterRow}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    Add filter
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Table
                    </span>
                    <select
                      value={draft.datasetId}
                      onChange={(e) => {
                        const nextDatasetId = e.target.value;
                        const nextColumn =
                          datasets.find((d) => d.id === nextDatasetId)
                            ?.columns[0] || "";
                        setDraft((prev) => ({
                          ...prev,
                          datasetId: nextDatasetId,
                          column: nextColumn,
                          values: [],
                          op: "in",
                          filters: [],
                          label: prev.label || nextColumn,
                        }));
                        setValueOptions([]);
                        setPreviewCounts([]);
                        setModalError(null);
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {!datasets.length && <option>No datasets</option>}
                      {datasets.map((ds) => (
                        <option key={ds.id} value={ds.id}>
                          {datasetLabel(ds.id)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Column
                    </span>
                    <select
                      value={draft.column}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          column: e.target.value,
                          values: [],
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {!columnsForDataset.length && <option>No columns</option>}
                      {columnsForDataset.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Operator
                    </span>
                    <select
                      value={draft.op}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          op: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {operatorOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                      Values (OR)
                    </span>
                    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      {valuesLoading && (
                        <span className="text-slate-500 dark:text-slate-400">
                          Loading...
                        </span>
                      )}
                      {!valuesLoading && !valueOptions.length && (
                        <span className="text-slate-500 dark:text-slate-400">
                          No values
                        </span>
                      )}
                      {valueOptions.map((val) => {
                        const checked = draft.values.includes(val);
                        return (
                          <label
                            key={val}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1 font-semibold shadow-sm transition ${
                              checked
                                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleValue(val)}
                            />
                            {val}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {!!draft.filters.length && (
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white/70 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/50">
                    {draft.filters.map((f) => {
                      const tableId = f.table || draft.datasetId;
                      const options =
                        columnOptions[tableId] ||
                        datasets.find((d) => d.id === tableId)?.columns ||
                        columnsForDataset;
                      const valueKey = `${tableId}::${f.field}`;
                      const optionValues =
                        filterValueOptions[valueKey] || valueOptions;
                      const optionLoading =
                        filterValueLoading[valueKey] || valuesLoading;
                      return (
                        <div
                          key={f.id}
                          className="grid gap-2 sm:grid-cols-[1fr,1fr,1fr,2fr,auto]"
                        >
                          <select
                            value={tableId}
                            onChange={(e) =>
                              updateFilterTable(f.id, e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {!datasets.length && <option>No tables</option>}
                            {datasets.map((ds) => (
                              <option key={ds.id} value={ds.id}>
                                {datasetLabel(ds.id)}
                              </option>
                            ))}
                          </select>

                          <select
                            value={f.field}
                            onChange={(e) =>
                              updateFilterField(f.id, e.target.value, tableId)
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {!options.length && <option>No columns</option>}
                            {options.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>

                          <select
                            value={f.op}
                            onChange={(e) =>
                              updateFilterOp(f.id, e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            {operatorOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                            {optionLoading && (
                              <span className="text-slate-500 dark:text-slate-400">
                                Loading...
                              </span>
                            )}
                            {!optionLoading && !optionValues.length && (
                              <span className="text-slate-500 dark:text-slate-400">
                                No values
                              </span>
                            )}
                            {optionValues.map((val) => {
                              const checked = f.values.includes(val);
                              return (
                                <label
                                  key={`${f.id}-${val}`}
                                  className={`flex items-center gap-2 rounded-full border px-3 py-1 font-semibold shadow-sm transition ${
                                    checked
                                      ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleFilterValue(f.id, val)
                                    }
                                  />
                                  {val}
                                </label>
                              );
                            })}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFilterRow(f.id)}
                            className="h-fit rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-100"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pick a table and column, then optionally restrict to specific
                  values. Leave values blank to show all.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Preview counts
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  Save banner
                </button>
              </div>

              {modalError && (
                <p className="text-sm text-rose-600 dark:text-rose-400">
                  {modalError}
                </p>
              )}

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-2 flex items-center justify-between text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Preview</span>
                  {previewLoading && <span>Loading...</span>}
                </div>
                {!previewLoading && previewCounts.length === 0 && (
                  <p className="text-slate-500 dark:text-slate-400">
                    Choose a column and click Preview counts.
                  </p>
                )}
                {!previewLoading && previewCounts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {previewCounts.map((item, idx) => {
                      const labelText = draft.label.trim() || draft.column;
                      return (
                        <div
                          key={`${item.value}-${idx}`}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <span className="uppercase tracking-wide">
                            {labelText}
                          </span>
                          <span className="rounded-full bg-slate-900/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700 dark:bg-white/10 dark:text-slate-100">
                            {item.value}
                          </span>
                          <span>: {item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default BannerManagementSection;
