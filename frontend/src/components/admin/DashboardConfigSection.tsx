import type { Dispatch, SetStateAction } from "react";
import ResultTable from "../ResultTable";
import type {
  ChartConfig,
  Dataset,
  TableConfig,
  UserRole,
  Widget,
  WidgetType,
} from "./types";
import { ROLE_OPTIONS } from "./types";

type PreviewTableProps = {
  tableConfig: TableConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

type PreviewChartProps = {
  widgetTitle?: string;
  chartConfig: ChartConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

type DashboardConfigSectionProps = {
  datasets: Dataset[];
  widgets: Widget[];
  widgetsLoading: boolean;
  groupValueOptions: Record<string, string[]>;
  groupValueLoading: Record<string, boolean>;
  editingWidgetId: string | null;
  savingWidgetId: string | null;
  showWidgetTypePicker: boolean;
  setShowWidgetTypePicker: Dispatch<SetStateAction<boolean>>;
  pendingWidgetType: WidgetType;
  setPendingWidgetType: Dispatch<SetStateAction<WidgetType>>;
  showPreview: boolean;
  setShowPreview: Dispatch<SetStateAction<boolean>>;
  previewWidgetId: string | null;
  setPreviewWidgetId: Dispatch<SetStateAction<string | null>>;
  previewData: { columns: string[]; rows: Record<string, unknown>[] } | null;
  previewLoading: boolean;
  previewError: string | null;
  userRole: UserRole;
  onAddWidgetClick: () => void;
  confirmAddWidget: () => void;
  updateWidget: (idx: number, patch: Partial<Widget>) => void;
  removeWidget: (idx: number) => void;
  handleStartEditWidget: (widgetKey: string) => void;
  handleSaveWidget: (widgetKey: string) => void;
  handleCancelEditWidget: () => void;
  getWidgetKey: (widget: Widget, index: number) => string;
  groupOptionsKey: (widgetKey: string, type: WidgetType) => string;
  getTableConfig: (widget: Widget) => TableConfig;
  getChartConfig: (widget: Widget) => ChartConfig;
  fetchGroupByValues: (
    widgetKey: string,
    type: WidgetType,
    datasetId: string,
    column: string,
    onValues: (values: string[]) => void
  ) => Promise<void>;
  setGroupValueOptions: Dispatch<SetStateAction<Record<string, string[]>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  loadPreviewData: (widget: Widget | undefined) => void | Promise<void>;
};

const DashboardConfigSection = ({
  datasets,
  widgets,
  widgetsLoading,
  groupValueOptions,
  groupValueLoading,
  editingWidgetId,
  savingWidgetId,
  showWidgetTypePicker,
  setShowWidgetTypePicker,
  pendingWidgetType,
  setPendingWidgetType,
  showPreview,
  setShowPreview,
  previewWidgetId,
  setPreviewWidgetId,
  previewData,
  previewLoading,
  previewError,
  userRole,
  onAddWidgetClick,
  confirmAddWidget,
  updateWidget,
  removeWidget,
  handleStartEditWidget,
  handleSaveWidget,
  handleCancelEditWidget,
  getWidgetKey,
  groupOptionsKey,
  getTableConfig,
  getChartConfig,
  fetchGroupByValues,
  setGroupValueOptions,
  setError,
  loadPreviewData,
}: DashboardConfigSectionProps) => {
  const previewWidget = widgets.find((w, widgetIdx) => {
    const key = getWidgetKey(w, widgetIdx);
    return key === previewWidgetId;
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Dashboard Config
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pick a widget type, wire it to a table, then save.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {widgets.length > 0 && (
            <>
              <select
                value={previewWidgetId ?? ""}
                onChange={(e) => setPreviewWidgetId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {widgets.map((w, idx) => {
                  const key = getWidgetKey(w, idx);
                  return (
                    <option key={key} value={key}>
                      {w.title || `Widget ${idx + 1}`}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                disabled={!previewWidgetId}
              >
                View
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onAddWidgetClick}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Add Widget
          </button>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {widgetsLoading && (
          <p className="text-slate-500 dark:text-slate-400">Loading widgets…</p>
        )}
        {!widgetsLoading && !widgets.length && (
          <p className="text-slate-500 dark:text-slate-400">
            No widgets configured.
          </p>
        )}
        {!widgetsLoading &&
          widgets.map((w, idx) => {
            const widgetType: WidgetType =
              (w.widget_type as WidgetType) || "table";
            const widgetKey = getWidgetKey(w, idx);
            const optionsKey = groupOptionsKey(widgetKey, widgetType);
            const isEditing = editingWidgetId === widgetKey;
            const isSavingThis = savingWidgetId === widgetKey;
            const savedGroupValues =
              widgetType === "table"
                ? getTableConfig(w).group_by_values || []
                : getChartConfig(w).group_by_values || [];
            const distinctOptions = Array.from(
              new Set([
                ...(groupValueOptions[optionsKey] || []),
                ...savedGroupValues,
              ])
            );
            const isGroupLoading = groupValueLoading[optionsKey];
            const tableConfig = getTableConfig(w);
            const chartConfig = getChartConfig(w);
            const tableDataset = datasets.find(
              (d) => d.id === tableConfig.dataset_id
            );
            const chartDataset = datasets.find(
              (d) => d.id === chartConfig.dataset_id
            );

            const handleWidgetTypeChange = (nextType: WidgetType) => {
              const defaultDataset = datasets[0]?.id || "";
              const baseConfig: TableConfig | ChartConfig =
                nextType === "table"
                  ? {
                      dataset_id: defaultDataset,
                      fields: [],
                      group_by: "",
                      group_by_values: [],
                    }
                  : {
                      dataset_id: defaultDataset,
                      chart_type: "bar",
                      x_field: "",
                      y_field: "",
                      group_by: "",
                      group_by_values: [],
                    };

              updateWidget(idx, {
                widget_type: nextType,
                config: baseConfig,
              });
            };

            const updateTableConfig = (next: Partial<TableConfig>) => {
              updateWidget(idx, {
                widget_type: "table",
                config: { ...tableConfig, ...next },
              });
            };

            const updateChartConfig = (next: Partial<ChartConfig>) => {
              updateWidget(idx, {
                widget_type: "chart",
                config: { ...chartConfig, ...next },
              });
            };

            return (
              <div
                key={w.id || idx}
                className="rounded-xl border border-slate-200 bg-white/60 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={w.title}
                      onChange={(e) =>
                        updateWidget(idx, { title: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Title"
                      className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    <select
                      value={widgetType}
                      onChange={(e) =>
                        handleWidgetTypeChange(e.target.value as WidgetType)
                      }
                      disabled={!isEditing}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value="table">Table</option>
                      <option value="chart">Chart</option>
                    </select>
                    <input
                      value={w.order_index ?? ""}
                      onChange={(e) =>
                        updateWidget(idx, {
                          order_index: Number(e.target.value) || 0,
                        })
                      }
                      disabled={!isEditing}
                      placeholder="Order"
                      className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    {userRole === "admin" ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {ROLE_OPTIONS.map((role) => {
                          const checked = w.roles?.includes(role);
                          return (
                            <label
                              key={role}
                              className={`flex items-center gap-1 rounded-full border px-3 py-1 font-semibold shadow-sm transition ${
                                checked
                                  ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const current = w.roles || [];
                                  const next = checked
                                    ? current.filter((r) => r !== role)
                                    : [...current, role];
                                  updateWidget(idx, {
                                    roles: next.length ? next : ["admin"],
                                  });
                                }}
                                disabled={!isEditing}
                              />
                              {role.replace(/_/g, " ")}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                        Roles:{" "}
                        {(w.roles || [userRole]).join(", ").replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewWidgetId(widgetKey);
                        setShowPreview(true);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      disabled={isSavingThis || isEditing}
                      title={isEditing ? "Save first to view" : "View preview"}
                    >
                      View
                    </button>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSaveWidget(widgetKey)}
                          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                          disabled={isSavingThis}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditWidget}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          disabled={isSavingThis}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditWidget(widgetKey)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeWidget(idx)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                      disabled={isSavingThis}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {widgetType === "table" ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Table
                      </label>
                      <select
                        value={tableConfig.dataset_id}
                        onChange={(e) => {
                          updateTableConfig({
                            dataset_id: e.target.value,
                            fields: [],
                            group_by: "",
                            group_by_values: [],
                          });
                          const key = groupOptionsKey(widgetKey, "table");
                          setGroupValueOptions((prev) => ({
                            ...prev,
                            [key]: [],
                          }));
                        }}
                        disabled={!isEditing}
                        className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {!datasets.length && (
                          <option value="">No datasets</option>
                        )}
                        {datasets.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.table_name || ds.original_file_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {tableDataset ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                          Fields for display
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {tableDataset.columns.map((col) => {
                            const checked = tableConfig.fields?.includes(col);
                            return (
                              <label
                                key={col}
                                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm transition ${
                                  checked
                                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const current = tableConfig.fields || [];
                                    const next = checked
                                      ? current.filter((f) => f !== col)
                                      : [...current, col];
                                    updateTableConfig({ fields: next });
                                  }}
                                  disabled={!isEditing}
                                />
                                {col}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-200">
                        Select a table to pick fields.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Group By
                      </label>
                      <select
                        value={tableConfig.group_by || ""}
                        onChange={(e) => {
                          const col = e.target.value;
                          updateTableConfig({
                            group_by: col,
                            group_by_values: [],
                          });
                          fetchGroupByValues(
                            widgetKey,
                            "table",
                            tableConfig.dataset_id || "",
                            col,
                            (values) =>
                              updateTableConfig({
                                group_by: col,
                                group_by_values: values,
                              })
                          );
                        }}
                        disabled={!isEditing}
                        className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="">None</option>
                        {tableDataset?.columns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    {tableConfig.group_by && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                          <span>Values</span>
                          {isGroupLoading && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Loading…
                            </span>
                          )}
                          {!isGroupLoading && !distinctOptions.length && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-200">
                              No values found
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {distinctOptions.map((val) => {
                            const checked =
                              tableConfig.group_by_values?.includes(val) ??
                              false;
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
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const current =
                                      tableConfig.group_by_values || [];
                                    const next = checked
                                      ? current.filter((v) => v !== val)
                                      : [...current, val];
                                    updateTableConfig({
                                      group_by_values: next,
                                    });
                                  }}
                                  disabled={!isEditing}
                                />
                                {val}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        Dataset
                      </label>
                      <select
                        value={chartConfig.dataset_id}
                        onChange={(e) => {
                          updateChartConfig({
                            dataset_id: e.target.value,
                            x_field: "",
                            y_field: "",
                            group_by: "",
                            group_by_values: [],
                          });
                          const key = groupOptionsKey(widgetKey, "chart");
                          setGroupValueOptions((prev) => ({
                            ...prev,
                            [key]: [],
                          }));
                        }}
                        disabled={!isEditing}
                        className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {!datasets.length && (
                          <option value="">No datasets</option>
                        )}
                        {datasets.map((ds) => (
                          <option key={ds.id} value={ds.id}>
                            {ds.table_name || ds.original_file_name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={chartConfig.chart_type || "bar"}
                        onChange={(e) =>
                          updateChartConfig({
                            chart_type: e.target
                              .value as ChartConfig["chart_type"],
                          })
                        }
                        disabled={!isEditing}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="bar">Bar</option>
                        <option value="line">Line</option>
                        <option value="pie">Pie</option>
                      </select>
                    </div>

                    {chartDataset ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                            X Axis
                          </label>
                          <select
                            value={chartConfig.x_field || ""}
                            onChange={(e) =>
                              updateChartConfig({ x_field: e.target.value })
                            }
                            disabled={!isEditing}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="">Select column</option>
                            {chartDataset.columns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                            Y Axis
                          </label>
                          <select
                            value={chartConfig.y_field || ""}
                            onChange={(e) =>
                              updateChartConfig({ y_field: e.target.value })
                            }
                            disabled={!isEditing}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="">Select column</option>
                            {chartDataset.columns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                            Group By (optional)
                          </label>
                          <select
                            value={chartConfig.group_by || ""}
                            onChange={(e) => {
                              const col = e.target.value;
                              updateChartConfig({
                                group_by: col,
                                group_by_values: [],
                              });
                              fetchGroupByValues(
                                widgetKey,
                                "chart",
                                chartConfig.dataset_id || "",
                                col,
                                (values) =>
                                  updateChartConfig({
                                    group_by: col,
                                    group_by_values: values,
                                  })
                              );
                            }}
                            disabled={!isEditing}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            <option value="">None</option>
                            {chartDataset.columns.map((col) => (
                              <option key={col} value={col}>
                                {col}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 dark:text-amber-200">
                        Select a dataset to configure chart axes.
                      </p>
                    )}
                    {chartConfig.group_by && chartDataset && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                          <span>Values</span>
                          {isGroupLoading && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Loading…
                            </span>
                          )}
                          {!isGroupLoading && !distinctOptions.length && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-200">
                              No values found
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {distinctOptions.map((val) => {
                            const checked =
                              chartConfig.group_by_values?.includes(val) ??
                              false;
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
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    const current =
                                      chartConfig.group_by_values || [];
                                    const next = checked
                                      ? current.filter((v) => v !== val)
                                      : [...current, val];
                                    updateChartConfig({
                                      group_by_values: next,
                                    });
                                  }}
                                />
                                {val}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <details className="mt-3 rounded-lg border border-slate-200 bg-white/60 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                  <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                    Advanced config (JSON)
                  </summary>
                  <textarea
                    value={JSON.stringify(w.config || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value || "{}");
                        updateWidget(idx, { config: parsed });
                        setError(null);
                      } catch {
                        setError("Invalid JSON in config");
                      }
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    rows={6}
                  />
                </details>
              </div>
            );
          })}
      </div>

      {showWidgetTypePicker && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
              Choose widget type
            </h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Start with the right layout for this widget.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPendingWidgetType("table")}
                className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  pendingWidgetType === "table"
                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <div className="text-base font-semibold">Table</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Pick fields and optional group by.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPendingWidgetType("chart")}
                className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  pendingWidgetType === "chart"
                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <div className="text-base font-semibold">Chart</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Choose axes and chart type.
                </div>
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowWidgetTypePicker(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddWidget}
                className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewWidget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Preview: {previewWidget.title || "Widget"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Type: {previewWidget.widget_type || "table"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-800 dark:text-slate-100">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold uppercase tracking-wide">
                  Preview Data
                </span>
                <button
                  type="button"
                  onClick={() =>
                    loadPreviewData(
                      widgets.find(
                        (w, idx) => getWidgetKey(w, idx) === previewWidgetId
                      )
                    )
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  Reload
                </button>
                {previewLoading && <span>Loading…</span>}
                {previewError && (
                  <span className="text-rose-600 dark:text-rose-300">
                    {previewError}
                  </span>
                )}
              </div>

              {!previewLoading && !previewError && previewData && (
                <>
                  {previewWidget.widget_type === "chart" ? (
                    <PreviewChart
                      widgetTitle={previewWidget.title}
                      chartConfig={getChartConfig(previewWidget)}
                      data={previewData}
                    />
                  ) : (
                    <PreviewTable
                      tableConfig={getTableConfig(previewWidget)}
                      data={previewData}
                    />
                  )}
                </>
              )}

              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                  Config JSON
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-slate-800 dark:text-slate-100">
                  {JSON.stringify(previewWidget, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const PreviewTable = ({ tableConfig, data }: PreviewTableProps) => {
  const groupBy = tableConfig.group_by || "";
  const groupValues = tableConfig.group_by_values || [];

  if (groupBy) {
    const filteredRows = data.rows.filter((row) => {
      const key = row[groupBy];
      const label = key === null || key === undefined ? "(blank)" : String(key);
      return !groupValues.length || groupValues.includes(label);
    });

    const showGroupColumn = groupValues.length !== 1;
    const baseColumns = tableConfig.fields?.length
      ? tableConfig.fields
      : data.columns;
    const columns = baseColumns.filter((c) => c);
    const finalColumns = showGroupColumn
      ? Array.from(new Set([...columns, groupBy, "count"]))
      : Array.from(new Set([...columns.filter((c) => c !== groupBy), "count"]));

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

    const rows = Array.from(grouped.values()).map(({ count, row }) => ({
      ...row,
      count,
    }));

    return (
      <ResultTable
        columns={finalColumns}
        rows={rows}
        showChartToggle={false}
        showCsvDownload={false}
      />
    );
  }

  const baseColumns = tableConfig.fields?.length
    ? tableConfig.fields
    : data.columns;
  const columns = baseColumns.filter((c) => c);
  const rows = data.rows.slice(0, 50).map((row) => {
    const trimmed: Record<string, unknown> = {};
    columns.forEach((c) => {
      trimmed[c] = row[c];
    });
    return trimmed;
  });

  return (
    <ResultTable
      columns={columns}
      rows={rows}
      showChartToggle={false}
      showCsvDownload={false}
    />
  );
};

const pieColors = [
  "#0ea5e9",
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
];

const PreviewChart = ({
  widgetTitle,
  chartConfig,
  data,
}: PreviewChartProps) => {
  const groupBy = chartConfig.group_by || "";
  const groupValues = chartConfig.group_by_values || [];
  const rowsFiltered = data.rows.filter((row) => {
    if (!groupBy) return true;
    const key = row[groupBy];
    const label = key === null || key === undefined ? "(blank)" : String(key);
    return !groupValues.length || groupValues.includes(label);
  });

  const xKey = chartConfig.x_field || data.columns[0];
  const yKey =
    chartConfig.y_field ||
    data.columns.find((c) =>
      data.rows.every((r) => Number.isFinite(Number(r[c])))
    );

  if (!xKey) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Pick X (and Y) to preview a chart.
      </div>
    );
  }

  const yIsNumeric =
    !!yKey && rowsFiltered.some((row) => Number.isFinite(Number(row[yKey])));

  const aggregated = new Map<
    string,
    {
      label: string;
      xLabel: string;
      groupLabel: string;
      yStrings: Set<string>;
      ySum: number;
      yHasValue: boolean;
      count: number;
    }
  >();

  rowsFiltered.slice(0, 200).forEach((row) => {
    const xLabelRaw = row[xKey];
    const xLabel =
      xLabelRaw === null || xLabelRaw === undefined
        ? "(blank)"
        : String(xLabelRaw);

    const groupLabelRaw = groupBy ? row[groupBy] : undefined;
    const groupLabel = groupBy
      ? groupLabelRaw === null || groupLabelRaw === undefined
        ? "(blank)"
        : String(groupLabelRaw)
      : "";

    const bucketLabel = groupBy ? `${xLabel} • ${groupLabel}` : xLabel;
    const bucketKey = groupBy ? `${xLabel}|||${groupLabel}` : xLabel;

    const yValRaw = yKey ? row[yKey] : undefined;
    const yNum = Number.isFinite(Number(yValRaw)) ? Number(yValRaw) : null;
    const yStr =
      yValRaw === null || yValRaw === undefined ? "(blank)" : String(yValRaw);

    if (!aggregated.has(bucketKey)) {
      aggregated.set(bucketKey, {
        label: bucketLabel,
        xLabel,
        groupLabel,
        yStrings: new Set<string>(),
        ySum: 0,
        yHasValue: false,
        count: 0,
      });
    }

    const entry = aggregated.get(bucketKey)!;
    if (yKey) {
      entry.yStrings.add(yStr);
    }
    if (yNum !== null) {
      entry.ySum += yNum;
      entry.yHasValue = true;
    }
    entry.count += 1;
  });

  const points = Array.from(aggregated.values()).map(
    ({ label, xLabel, groupLabel, ySum, yHasValue, yStrings, count }) => {
      const yValueNumeric = yIsNumeric && yHasValue ? ySum : null;
      const yValueLabel =
        yValueNumeric !== null
          ? String(yValueNumeric)
          : yKey
            ? Array.from(yStrings).join(", ")
            : "";
      return {
        label,
        xLabel,
        groupLabel,
        yValue: yValueNumeric !== null ? yValueNumeric : count,
        yValueNumeric,
        yValueLabel,
        count,
      };
    }
  );

  const showYSeries = !!yKey;

  if (!points.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No data available to chart.
      </div>
    );
  }

  const valueMax = Math.max(
    1,
    ...points
      .map((p) => [showYSeries ? (p.yValue ?? 0) : 0, p.count])
      .flat()
      .filter((n) => Number.isFinite(n))
  );
  const chartType = chartConfig.chart_type || "bar";

  if (chartType === "pie") {
    const pieSeries = points
      .map((p) => ({ label: p.label, value: p.yValue ?? p.count }))
      .filter((p) => Number.isFinite(p.value) && p.value !== 0);

    if (!pieSeries.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          No data available to chart.
        </div>
      );
    }

    const total = pieSeries.reduce((s, p) => s + p.value, 0) || 1;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {widgetTitle || "Chart"} (Pie)
        </div>
        <div className="flex flex-col gap-3 md:flex-row">
          <svg
            width="260"
            height="240"
            viewBox="0 0 260 240"
            role="img"
            aria-label="Pie chart"
          >
            <circle cx="120" cy="120" r="110" fill="#e2e8f0" />
            {(() => {
              let startAngle = -Math.PI / 2;
              return pieSeries.map((p, idx) => {
                const slice = (p.value / total) * Math.PI * 2;
                const end = startAngle + slice;
                const path = (
                  <path
                    key={idx}
                    d={`M120 120 L ${120 + 110 * Math.cos(startAngle)} ${120 + 110 * Math.sin(startAngle)} A 110 110 0 ${slice > Math.PI ? 1 : 0} 1 ${120 + 110 * Math.cos(end)} ${120 + 110 * Math.sin(end)} Z`}
                    fill={pieColors[idx % pieColors.length]}
                  />
                );
                startAngle = end;
                return path;
              });
            })()}
          </svg>
          <div className="flex flex-col gap-2 text-xs text-slate-700 dark:text-slate-200">
            {pieSeries.map((p, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: pieColors[idx % pieColors.length] }}
                />
                <span className="font-semibold">{p.value}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const barContainerHeight = 200;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span>
          {widgetTitle || "Chart"} ({chartType})
        </span>
        <span className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Count
          </span>
          {yKey && (
            <span className="flex items-center gap-1 text-sky-500">
              <span className="h-2 w-2 rounded-full bg-sky-500" /> Y value
            </span>
          )}
        </span>
      </div>
      <div
        className="flex items-end gap-4 overflow-x-auto"
        style={{ minHeight: "260px" }}
      >
        {points.map((p, idx) => {
          const scale = barContainerHeight / valueMax;
          const cHeightPx = Math.max(8, p.count * scale);
          const barWidth = Math.max(28, Math.min(96, 520 / points.length));
          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 text-xs text-slate-600 dark:text-slate-200"
            >
              <div
                className="flex items-end gap-2"
                style={{ height: `${barContainerHeight}px` }}
              >
                <div
                  className="flex flex-col items-center gap-1"
                  style={{ width: `${barWidth}px` }}
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                    {p.count}
                  </span>
                  {yKey && (
                    <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                      {p.yValueLabel} ({p.count})
                    </span>
                  )}
                  <div
                    className="w-full rounded-t-md bg-amber-500"
                    style={{ height: `${cHeightPx}px` }}
                  />
                </div>
              </div>
              <div className="w-32 text-center text-[11px] text-slate-600 dark:text-slate-300">
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

export default DashboardConfigSection;
