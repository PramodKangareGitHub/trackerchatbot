import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type {
  ChartConfig,
  Dashboard,
  Dataset,
  TableConfig,
  UserRole,
  Widget,
  WidgetType,
} from "./types";
import { ROLE_OPTIONS } from "./types";
import PreviewChart from "./DashboardManagement/PreviewChart";
import DashboardSelectorActions from "./DashboardManagement/DashboardSelectorActions";
import WidgetTypePicker from "./DashboardManagement/WidgetTypePicker";
import PreviewTable from "./DashboardManagement/PreviewTable";
import ResultTable from "../ResultTable";

type DashboardConfigSectionProps = {
  datasets: Dataset[];
  widgets: Widget[];
  selectedDatasetId: string | null;
  widgetsLoading: boolean;
  dashboards: Dashboard[];
  dashboardsLoading: boolean;
  selectedDashboardId: string | null;
  onSelectDashboard: (dashboardId: string) => void;
  onReorderDashboard: (dashboardId: string, direction: "up" | "down") => void;
  onCreateDashboard: (
    name: string,
    description?: string
  ) => void | Promise<void>;
  onUpdateDashboard: (
    id: string,
    name: string,
    description?: string
  ) => void | Promise<void>;
  onDeleteDashboard: (id: string) => void | Promise<void>;
  dashboardSaving: boolean;
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
  onSelectDataset: (datasetId: string) => void;
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
  selectedDatasetId,
  widgetsLoading,
  dashboards,
  dashboardsLoading,
  selectedDashboardId,
  onSelectDashboard,
  onReorderDashboard,
  onCreateDashboard,
  onUpdateDashboard,
  onDeleteDashboard,
  dashboardSaving,
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
  onSelectDataset,
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
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDesc, setNewDashboardDesc] = useState("");
  const [editDashboardName, setEditDashboardName] = useState("");
  const [editDashboardDesc, setEditDashboardDesc] = useState("");
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<string[]>([]);

  const selectedDashboard = useMemo(
    () => dashboards.find((d) => d.id === selectedDashboardId) || null,
    [dashboards, selectedDashboardId]
  );

  useEffect(() => {
    setEditDashboardName(selectedDashboard?.name || "");
    setEditDashboardDesc(selectedDashboard?.description || "");
  }, [selectedDashboard]);

  const widgetEntries = useMemo(
    () =>
      widgets.map((widget, widgetIdx) => {
        const widgetType: WidgetType =
          (widget.widget_type as WidgetType) || "table";
        const config =
          widgetType === "table"
            ? getTableConfig(widget)
            : getChartConfig(widget);
        const datasetId = config.dataset_id || "";
        return {
          widget,
          widgetIdx,
          widgetKey: getWidgetKey(widget, widgetIdx),
          widgetType,
          datasetId,
        };
      }),
    [widgets, getWidgetKey, getTableConfig, getChartConfig]
  );

  useEffect(() => {
    const allKeys = widgetEntries.map((w) => w.widgetKey);
    setCollapsedWidgetIds((prev) => {
      if (!prev.length) return allKeys; // default: all minimized
      // keep existing states, add any new keys as collapsed
      const preserved = prev.filter((k) => allKeys.includes(k));
      const newOnes = allKeys.filter((k) => !prev.includes(k));
      return [...preserved, ...newOnes];
    });
  }, [widgetEntries]);

  const activeDatasetId = selectedDatasetId || datasets[0]?.id || "";

  useEffect(() => {
    if (!selectedDatasetId && datasets[0]?.id) {
      onSelectDataset(datasets[0].id);
    }
  }, [selectedDatasetId, datasets, onSelectDataset]);

  useEffect(() => {
    if (
      selectedDatasetId &&
      datasets.length &&
      !datasets.some((d) => d.id === selectedDatasetId)
    ) {
      onSelectDataset(datasets[0].id);
    }
  }, [selectedDatasetId, datasets, onSelectDataset]);

  const scopedWidgets = useMemo(
    () =>
      widgetEntries.filter((entry) =>
        entry.datasetId ? entry.datasetId === activeDatasetId : true
      ),
    [widgetEntries, activeDatasetId]
  );

  useEffect(() => {
    if (!scopedWidgets.length) {
      setShowPreview(false);
      setPreviewWidgetId(null);
      return;
    }
    const hasCurrent = scopedWidgets.some(
      (entry) => entry.widgetKey === previewWidgetId
    );
    if (!hasCurrent) {
      setPreviewWidgetId(scopedWidgets[0].widgetKey);
    }
  }, [scopedWidgets, previewWidgetId, setPreviewWidgetId, setShowPreview]);

  const previewWidget = widgetEntries.find(
    (entry) => entry.widgetKey === previewWidgetId
  )?.widget;

  const toggleWidgetCollapse = (key: string) => {
    setCollapsedWidgetIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleCreateDashboard = async () => {
    if (userRole !== "admin") return;
    await onCreateDashboard(newDashboardName, newDashboardDesc);
    setNewDashboardName("");
    setNewDashboardDesc("");
  };

  const handleUpdateDashboard = async () => {
    if (!selectedDashboardId) return;
    await onUpdateDashboard(
      selectedDashboardId,
      editDashboardName,
      editDashboardDesc
    );
  };

  const handleDeleteDashboard = async () => {
    if (!selectedDashboardId) return;
    await onDeleteDashboard(selectedDashboardId);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <DashboardSelectorActions
        dashboards={dashboards}
        dashboardsLoading={dashboardsLoading}
        selectedDashboardId={selectedDashboardId}
        onSelectDashboard={onSelectDashboard}
        onReorderDashboard={onReorderDashboard}
        editDashboardName={editDashboardName}
        editDashboardDesc={editDashboardDesc}
        setEditDashboardName={setEditDashboardName}
        setEditDashboardDesc={setEditDashboardDesc}
        handleUpdateDashboard={handleUpdateDashboard}
        handleDeleteDashboard={handleDeleteDashboard}
        newDashboardName={newDashboardName}
        newDashboardDesc={newDashboardDesc}
        setNewDashboardName={setNewDashboardName}
        setNewDashboardDesc={setNewDashboardDesc}
        handleCreateDashboard={handleCreateDashboard}
        dashboardSaving={dashboardSaving}
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onSelectDataset={onSelectDataset}
        scopedWidgets={scopedWidgets}
        previewWidgetId={previewWidgetId}
        setPreviewWidgetId={setPreviewWidgetId}
        setShowPreview={setShowPreview}
        userRole={userRole}
      />

      {selectedDashboardId && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Widgets for this dashboard
          </span>
          <button
            type="button"
            onClick={onAddWidgetClick}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            disabled={dashboardsLoading}
            title={
              selectedDashboardId ? "Add widget" : "Create a dashboard first"
            }
          >
            Add Widget
          </button>
        </div>
      )}

      {!selectedDashboardId && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create or select a dashboard to configure widgets.
        </p>
      )}

      <div className="space-y-3 text-sm">
        {widgetsLoading && (
          <p className="text-slate-500 dark:text-slate-400">
            Loading widgets...
          </p>
        )}
        {!widgetsLoading && !scopedWidgets.length && (
          <p className="text-slate-500 dark:text-slate-400">
            No widgets for this dataset yet.
          </p>
        )}
        {!widgetsLoading &&
          scopedWidgets.map(
            ({ widget: w, widgetIdx: idx, widgetKey, widgetType }) => {
              const optionsKey = groupOptionsKey(widgetKey, widgetType);
              const isEditing = editingWidgetId === widgetKey;
              const isSavingThis = savingWidgetId === widgetKey;
              const isCollapsed =
                collapsedWidgetIds.includes(widgetKey) && !isEditing;
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
                const defaultDataset = activeDatasetId || datasets[0]?.id || "";
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
                  className="rounded-xl border border-slate-200 bg-white/60 p-3 shadow-sm outline outline-2 outline-slate-200/80 dark:border-slate-700 dark:bg-slate-900/70 dark:outline-slate-800"
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
                          {(w.roles || [userRole])
                            .join(", ")
                            .replace(/_/g, " ")}
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
                        title={
                          isEditing ? "Save first to view" : "View preview"
                        }
                      >
                        🔍 View
                      </button>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveWidget(widgetKey)}
                            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
                            disabled={isSavingThis}
                          >
                            💾 Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEditWidget}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            disabled={isSavingThis}
                          >
                            ✖️ Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            // expand when entering edit mode
                            if (collapsedWidgetIds.includes(widgetKey)) {
                              setCollapsedWidgetIds((prev) =>
                                prev.filter((k) => k !== widgetKey)
                              );
                            }
                            handleStartEditWidget(widgetKey);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeWidget(idx)}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                        disabled={isSavingThis}
                      >
                        🗑 Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWidgetCollapse(widgetKey)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        title={
                          isCollapsed ? "Expand widget" : "Collapse widget"
                        }
                      >
                        {isCollapsed ? "➕ Maximize" : "➖ Minimize"}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <>
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
                                  {ds.original_file_name ||
                                    ds.table_name ||
                                    ds.id}
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
                                  const checked =
                                    tableConfig.fields?.includes(col);
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
                                          const current =
                                            tableConfig.fields || [];
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
                                    Loading...
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
                                    tableConfig.group_by_values?.includes(
                                      val
                                    ) ?? false;
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
                                  {ds.original_file_name ||
                                    ds.table_name ||
                                    ds.id}
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
                                    updateChartConfig({
                                      x_field: e.target.value,
                                    })
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
                                    updateChartConfig({
                                      y_field: e.target.value,
                                    })
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
                                    Loading...
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
                                    chartConfig.group_by_values?.includes(
                                      val
                                    ) ?? false;
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
                    </>
                  )}
                </div>
              );
            }
          )}
      </div>

      <WidgetTypePicker
        show={showWidgetTypePicker}
        pendingWidgetType={pendingWidgetType}
        setPendingWidgetType={setPendingWidgetType}
        setShowWidgetTypePicker={setShowWidgetTypePicker}
        confirmAddWidget={confirmAddWidget}
      />

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
                  onClick={() => loadPreviewData(previewWidget)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  Reload
                </button>
                {previewLoading && <span>Loading...</span>}
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

export default DashboardConfigSection;
