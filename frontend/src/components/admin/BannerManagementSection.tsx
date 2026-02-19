import { useEffect, useMemo, useState } from "react";
import type { Dashboard, Dataset, UserRole } from "./types";
import type { BannerConfig, BannerValueCount } from "../dashboard/bannerUtils";
import { formatDatasetName } from "../dashboard/bannerUtils";

type BannerManagementSectionProps = {
  dashboards: Dashboard[];
  selectedDashboardId: string | null;
  datasets: Dataset[];
  bannerConfigs: BannerConfig[];
  onSaveBanner: (config: BannerConfig) => void;
  onDeleteBanner: (id: string) => void;
  loadColumnValues: (datasetId: string, column: string) => Promise<string[]>;
  loadValueCounts: (
    datasetId: string,
    column: string,
    selectedValues?: string[]
  ) => Promise<BannerValueCount[]>;
  userRole: UserRole;
};

type BannerDraft = {
  id: string | null;
  dashboardId: string;
  datasetId: string;
  column: string;
  label: string;
  values: string[];
  role: string;
};

const BannerManagementSection = ({
  datasets,
  dashboards,
  selectedDashboardId,
  bannerConfigs,
  onSaveBanner,
  onDeleteBanner,
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
    role: userRole,
  });
  const [valueOptions, setValueOptions] = useState<string[]>([]);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [previewCounts, setPreviewCounts] = useState<BannerValueCount[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === draft.datasetId),
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
    if (allowedDashboards.length && !draft.dashboardId) {
      resetDraft(allowedDashboards[0].id, datasets[0]?.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDashboards]);

  const resetDraft = (targetDashboardId?: string, targetDatasetId?: string) => {
    const nextDashboardId =
      targetDashboardId ||
      selectedDashboardId ||
      allowedDashboards[0]?.id ||
      "";
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
      role: userRole,
    });
    setValueOptions([]);
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

        setValueOptions(padded);
        if (padded.length && draft.values.length === 0) {
          setDraft((prev) => ({ ...prev, values: [padded[0]] }));
        }
      })
      .catch((err) =>
        setModalError(
          err instanceof Error ? err.message : "Failed to load column values"
        )
      )
      .finally(() => setValuesLoading(false));
  }, [showModal, draft.datasetId, draft.column, loadColumnValues]);

  const selectValue = (val: string | null) => {
    setDraft((prev) => ({ ...prev, values: val ? [val] : [] }));
  };

  const handlePreview = async () => {
    if (!draft.datasetId || !draft.column) {
      setModalError("Select a dataset and column first.");
      return;
    }
    setPreviewLoading(true);
    setModalError(null);
    try {
      let counts = await loadValueCounts(
        draft.datasetId,
        draft.column,
        draft.values
      );

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

      counts.sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        return a.value.localeCompare(b.value);
      });

      setPreviewCounts(counts);
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
      label: draft.label.trim() || draft.column,
      values: draft.values,
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
          disabled={!datasets.length || !dashboards.length}
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
              <div className="grid gap-3 sm:grid-cols-3">
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
                    {!allowedDashboards.length && (
                      <option>No dashboards</option>
                    )}
                    {allowedDashboards.map((dash) => (
                      <option key={dash.id} value={dash.id}>
                        {dash.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Dataset
                  </label>
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
                        label: prev.label || nextColumn,
                      }));
                      setValueOptions([]);
                      setPreviewCounts([]);
                      setModalError(null);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {datasetLabel(ds.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    Column
                  </label>
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
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  <span>Values (optional)</span>
                  {valuesLoading && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Loading...
                    </span>
                  )}
                  {!valuesLoading && !valueOptions.length && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-200">
                      No distinct values found
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {valueOptions.map((val) => {
                    const checked = draft.values.includes(val);
                    return (
                      <label
                        key={val}
                        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                          checked
                            ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="banner-value"
                          checked={checked}
                          onChange={() => selectValue(val)}
                        />
                        {val}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select one value to filter. Leave blank to see counts after
                  saving.
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
                      const isBooleanValue = ["yes", "no"].includes(
                        item.value.trim().toLowerCase()
                      );
                      const labelText = draft.label.trim() || draft.column;
                      return (
                        <div
                          key={`${item.value}-${idx}`}
                          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <span className="uppercase tracking-wide">
                            {labelText}
                          </span>
                          {isBooleanValue && (
                            <span className="rounded-full bg-slate-900/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700 dark:bg-white/10 dark:text-slate-100">
                              {item.value}
                            </span>
                          )}
                          {!isBooleanValue && (
                            <span className="uppercase tracking-wide">
                              {item.value}
                            </span>
                          )}
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
