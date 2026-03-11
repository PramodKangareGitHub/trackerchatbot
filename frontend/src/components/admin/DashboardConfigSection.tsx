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
import PreviewChart from "./DashboardManagement/PreviewChart";
import DashboardSelectorActions from "./DashboardManagement/DashboardSelectorActions";
import WidgetTypePicker from "./DashboardManagement/WidgetTypePicker";
import PreviewTable from "./DashboardManagement/PreviewTable";
import ResultTable from "../ResultTable";
import { buildFixedDatasets, fixedDatasetIds } from "./fixedDatasets";

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
  roleOptions: UserRole[];
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
  filterOptionsKey: (widgetKey: string, type: WidgetType) => string;
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
  loadColumns: (datasetId: string) => Promise<string[]>;
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
  roleOptions,
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
  filterOptionsKey,
  getTableConfig,
  getChartConfig,
  fetchGroupByValues,
  setGroupValueOptions,
  setError,
  loadPreviewData,
  loadColumns,
}: DashboardConfigSectionProps) => {
  const [newDashboardName, setNewDashboardName] = useState("");
  const [newDashboardDesc, setNewDashboardDesc] = useState("");
  const [editDashboardName, setEditDashboardName] = useState("");
  const [editDashboardDesc, setEditDashboardDesc] = useState("");
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<string[]>([]);

  const availableDatasets: Dataset[] = useMemo(
    () => buildFixedDatasets(datasets),
    [datasets]
  );

  const datasetLookup = useMemo(() => {
    const map = new Map<string, Dataset>();
    datasets.forEach((ds) => {
      if (ds.id) map.set(ds.id, ds);
      if (ds.table_name) map.set(ds.table_name, ds);
    });
    availableDatasets.forEach((ds) => {
      if (!map.has(ds.id)) {
        map.set(ds.id, ds);
      }
    });
    return map;
  }, [datasets, availableDatasets]);

  const selectedDashboard = useMemo(
    () => dashboards.find((d) => d.id === selectedDashboardId) || null,
    [dashboards, selectedDashboardId]
  );

  const availableFilterTables = useMemo(
    () =>
      Array.from(
        new Set([
          ...availableDatasets.map((ds) => ds.id),
          ...datasets.map((ds) => ds.id),
        ])
      ),
    [availableDatasets, datasets]
  );

  const safeFilterTables =
    availableFilterTables.length > 0 ? availableFilterTables : [];
  const defaultFilterTable = safeFilterTables[0] || "";

  const operatorOptions = [
    { value: "in", label: "In" },
    { value: "not_in", label: "Not In" },
    { value: "=", label: "Equals" },
    { value: "!=", label: "Not Equals" },
    { value: ">", label: "Greater Than" },
    { value: ">=", label: "Greater Or Equal" },
    { value: "<", label: "Less Than" },
    { value: "<=", label: "Less Or Equal" },
    { value: "between", label: "Between (2 values)" },
    { value: "contains", label: "Contains" },
  ];

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
    const toLoad = new Set<string>();
    const consider = (id?: string) => {
      if (id) toLoad.add(id);
    };

    widgetEntries.forEach(({ widget }) => {
      const tableCfg = getTableConfig(widget);
      const chartCfg = getChartConfig(widget);

      consider(tableCfg.dataset_id);
      (tableCfg.joined_tables || []).forEach(consider);
      (tableCfg.filters || []).forEach((f) => consider(f.table));

      consider(chartCfg.dataset_id);
      (chartCfg.joined_tables || []).forEach(consider);
      (chartCfg.filters || []).forEach((f) => consider(f.table));

      const filterTable = chartCfg.filter_by?.includes(".")
        ? chartCfg.filter_by.split(".")[0]
        : chartCfg.dataset_id || chartCfg.joined_tables?.[0];
      consider(filterTable);
    });

    toLoad.forEach((id) => {
      const ds = datasetLookup.get(id);
      if (!ds || (ds.columns || []).length) return;
      loadColumns(id);
    });
  }, [
    widgetEntries,
    datasetLookup,
    loadColumns,
    getTableConfig,
    getChartConfig,
  ]);

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

  const activeDatasetId = selectedDatasetId || availableDatasets[0]?.id || "";

  useEffect(() => {
    if (!selectedDatasetId && availableDatasets[0]?.id) {
      onSelectDataset(availableDatasets[0].id);
    }
  }, [selectedDatasetId, availableDatasets, onSelectDataset]);

  useEffect(() => {
    if (
      selectedDatasetId &&
      availableDatasets.length &&
      !availableDatasets.some((d) => d.id === selectedDatasetId)
    ) {
      onSelectDataset(availableDatasets[0].id);
    }
  }, [selectedDatasetId, availableDatasets, onSelectDataset]);

  const scopedWidgets = useMemo(() => widgetEntries, [widgetEntries]);

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

  // Preload filter value options for existing filters when editing widgets so the chip lists
  // show available values instead of only the already-selected ones.
  useEffect(() => {
    widgetEntries.forEach(({ widget, widgetKey }) => {
      const tableFilterKey = filterOptionsKey(widgetKey, "table");
      const chartFilterKey = filterOptionsKey(widgetKey, "chart");
      const tableConfig = getTableConfig(widget);
      const chartConfig = getChartConfig(widget);

      const tableFilters = tableConfig.filters || [];
      tableFilters.forEach((flt, idx) => {
        const filterKey = `${tableFilterKey}-f${idx}`;
        const cacheKey = groupOptionsKey(filterKey, "table");
        const tableId = flt.table || defaultFilterTable;
        const columnOnly = flt.field?.includes(".")
          ? flt.field.split(".").slice(-1)[0]
          : flt.field;
        const hasCache = (groupValueOptions[cacheKey] || []).length > 0;
        const isLoading = groupValueLoading[cacheKey];
        if (!tableId || !columnOnly || hasCache || isLoading) return;
        fetchGroupByValues(filterKey, "table", tableId, columnOnly, (values) =>
          setGroupValueOptions((prev) => ({
            ...prev,
            [filterKey]: values,
            [cacheKey]: values,
          }))
        ).catch(() =>
          setGroupValueOptions((prev) => ({
            ...prev,
            [filterKey]: [],
            [cacheKey]: [],
          }))
        );
      });

      const chartFilters = chartConfig.filters || [];
      chartFilters.forEach((flt, idx) => {
        const filterKey = `${chartFilterKey}-f${idx}`;
        const cacheKey = groupOptionsKey(filterKey, "chart");
        const tableId = flt.table || defaultFilterTable;
        const columnOnly = flt.field?.includes(".")
          ? flt.field.split(".").slice(-1)[0]
          : flt.field;
        const hasCache = (groupValueOptions[cacheKey] || []).length > 0;
        const isLoading = groupValueLoading[cacheKey];
        if (!tableId || !columnOnly || hasCache || isLoading) return;
        fetchGroupByValues(filterKey, "chart", tableId, columnOnly, (values) =>
          setGroupValueOptions((prev) => ({
            ...prev,
            [filterKey]: values,
            [cacheKey]: values,
          }))
        ).catch(() =>
          setGroupValueOptions((prev) => ({
            ...prev,
            [filterKey]: [],
            [cacheKey]: [],
          }))
        );
      });
    });
  }, [
    widgetEntries,
    filterOptionsKey,
    groupOptionsKey,
    defaultFilterTable,
    getTableConfig,
    getChartConfig,
    groupValueOptions,
    groupValueLoading,
    fetchGroupByValues,
    setGroupValueOptions,
  ]);

  // Preload quick filter values when a widget already has filter_by set so the chips show options.
  useEffect(() => {
    widgetEntries.forEach(({ widget, widgetKey, widgetType }) => {
      const cfg =
        widgetType === "table"
          ? getTableConfig(widget)
          : getChartConfig(widget);
      const filterBy = cfg.filter_by;
      if (!filterBy) return;

      const optionsKey = filterOptionsKey(widgetKey, widgetType);
      const fetchKey = `${widgetKey}-filter`;
      const hasCache = (groupValueOptions[optionsKey] || []).length > 0;
      const isLoading = groupValueLoading[optionsKey];
      if (hasCache || isLoading) return;

      const columnOnly = filterBy.includes(".")
        ? filterBy.split(".").slice(-1)[0]
        : filterBy;
      const datasetForColumn = filterBy.includes(".")
        ? filterBy.split(".")[0]
        : cfg.dataset_id || cfg.joined_tables?.[0] || defaultFilterTable;
      if (!datasetForColumn || !columnOnly) return;

      fetchGroupByValues(
        fetchKey,
        widgetType,
        datasetForColumn,
        columnOnly,
        (values) =>
          setGroupValueOptions((prev) => ({
            ...prev,
            [optionsKey]: values,
          }))
      ).catch(() =>
        setGroupValueOptions((prev) => ({
          ...prev,
          [optionsKey]: [],
        }))
      );
    });
  }, [
    widgetEntries,
    filterOptionsKey,
    getTableConfig,
    getChartConfig,
    fetchGroupByValues,
    groupValueOptions,
    groupValueLoading,
    setGroupValueOptions,
    defaultFilterTable,
  ]);

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
        datasets={availableDatasets}
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
            Widget List
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
          <p className="text-slate-500 dark:text-slate-400">No widgets yet.</p>
        )}
        {!widgetsLoading &&
          scopedWidgets.map(
            ({ widget: w, widgetIdx: idx, widgetKey, widgetType }) => {
              const optionsKey = groupOptionsKey(widgetKey, widgetType);
              const tableFilterKey = filterOptionsKey(widgetKey, "table");
              const chartFilterKey = filterOptionsKey(widgetKey, "chart");
              const isEditing = editingWidgetId === widgetKey;
              const isSavingThis = savingWidgetId === widgetKey;
              const isCollapsed =
                collapsedWidgetIds.includes(widgetKey) && !isEditing;
              const savedGroupValues =
                widgetType === "table"
                  ? getTableConfig(w).group_by_values || []
                  : getChartConfig(w).group_by_values || [];
              const savedChartFilterValues =
                getChartConfig(w).filter_values || [];
              const chartFilterOptions = Array.from(
                new Set([
                  ...(groupValueOptions[chartFilterKey] || []),
                  ...savedChartFilterValues,
                ])
              );
              const isChartFilterLoading = groupValueLoading[chartFilterKey];
              const tableConfig = getTableConfig(w);
              const chartConfig = getChartConfig(w);
              const primaryTableId =
                tableConfig.dataset_id ||
                tableConfig.joined_tables?.[0] ||
                availableDatasets[0]?.id ||
                "";
              const primaryChartId =
                chartConfig.dataset_id ||
                chartConfig.joined_tables?.[0] ||
                availableDatasets[0]?.id ||
                "";
              const tableDataset = datasetLookup.get(primaryTableId);
              const chartDataset = datasetLookup.get(primaryChartId);
              const joinedTableIds = (
                tableConfig.joined_tables?.length
                  ? tableConfig.joined_tables
                  : [primaryTableId]
              ).filter(Boolean);
              const joinedChartTableIds = (
                chartConfig.joined_tables?.length
                  ? chartConfig.joined_tables
                  : [primaryChartId]
              ).filter(Boolean);
              const joinedColumns = Array.from(
                new Set(
                  joinedTableIds.flatMap((t) =>
                    (datasetLookup.get(t)?.columns || []).map(
                      (c) => `${t}.${c}`
                    )
                  )
                )
              );
              const joinedChartColumns = Array.from(
                new Set(
                  joinedChartTableIds.flatMap((t) =>
                    (datasetLookup.get(t)?.columns || []).map(
                      (c) => `${t}.${c}`
                    )
                  )
                )
              );

              const primaryTableColumns = (tableDataset?.columns || []).map(
                (c) => (primaryTableId ? `${primaryTableId}.${c}` : c)
              );

              const tableFieldOptions = primaryTableColumns;

              const displayFieldName = (col: string) =>
                col.includes(".") ? col.split(".").slice(-1)[0] : col;

              const chartFieldOptions = Array.from(
                new Set([
                  ...(joinedChartColumns.length
                    ? joinedChartColumns
                    : (chartDataset?.columns || []).map((c) =>
                        primaryChartId ? `${primaryChartId}.${c}` : c
                      )),
                  ...(chartConfig.x_field ? [chartConfig.x_field] : []),
                  ...(chartConfig.y_field ? [chartConfig.y_field] : []),
                  ...(chartConfig.filter_by ? [chartConfig.filter_by] : []),
                  ...(chartConfig.group_by ? [chartConfig.group_by] : []),
                ])
              );

              const handleWidgetTypeChange = (nextType: WidgetType) => {
                const defaultDataset =
                  activeDatasetId || availableDatasets[0]?.id || "";
                const baseConfig: TableConfig | ChartConfig =
                  nextType === "table"
                    ? {
                        dataset_id: defaultDataset,
                        fields: [],
                        group_by: "",
                        group_by_values: [],
                        filter_by: "",
                        filter_values: [],
                      }
                    : {
                        dataset_id: defaultDataset,
                        chart_type: "bar",
                        x_field: "",
                        y_field: "",
                        group_by: "",
                        group_by_values: [],
                        filter_by: "",
                        filter_values: [],
                      };

                updateWidget(idx, {
                  widget_type: nextType,
                  config: baseConfig,
                });
              };

              const tableColumnsFor = (tableId: string) =>
                datasetLookup.get(tableId)?.columns || [];

              const makeTableFilterKey = (index: number) =>
                `${tableFilterKey}-f${index}`;

              const makeChartFilterKey = (index: number) =>
                `${chartFilterKey}-f${index}`;

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

              const currentTableFilters = tableConfig.filters || [];
              const currentChartFilters = chartConfig.filters || [];

              const ensureEditingAndExpanded = () => {
                if (collapsedWidgetIds.includes(widgetKey)) {
                  setCollapsedWidgetIds((prev) =>
                    prev.filter((k) => k !== widgetKey)
                  );
                }
                if (!isEditing) {
                  handleStartEditWidget(widgetKey);
                }
              };

              const clearFilterOptionsCache = (
                key: string,
                type?: WidgetType
              ) => {
                const derivedKey = type ? groupOptionsKey(key, type) : key;
                setGroupValueOptions((prev) => ({
                  ...prev,
                  [key]: [],
                  [derivedKey]: [],
                }));
              };

              const syncTableFilters = (
                nextFilters: NonNullable<TableConfig["filters"]>
              ) => {
                updateTableConfig({ filters: nextFilters });
              };

              const syncChartFilters = (
                nextFilters: NonNullable<ChartConfig["filters"]>
              ) => {
                updateChartConfig({ filters: nextFilters });
              };

              const getOp = (flt: { op?: string; operator?: string }) =>
                flt.op || (flt as any).operator || "in";

              const addTableFilter = () => {
                const fallbackTable = defaultFilterTable || safeFilterTables[0];
                if (!fallbackTable) return;
                ensureEditingAndExpanded();

                // If no dataset is selected yet, default it so filter tables work.
                if (!tableConfig.dataset_id) {
                  updateTableConfig({
                    dataset_id: fallbackTable,
                    joined_tables: tableConfig.joined_tables?.length
                      ? tableConfig.joined_tables
                      : [fallbackTable],
                  });
                }

                const nextFilters = [
                  ...currentTableFilters,
                  { table: fallbackTable, field: "", op: "in", value: "" },
                ];
                const newKey = makeTableFilterKey(nextFilters.length - 1);
                clearFilterOptionsCache(newKey, "table");
                syncTableFilters(nextFilters);
              };

              const addChartFilter = () => {
                const fallbackTable = defaultFilterTable || safeFilterTables[0];
                if (!fallbackTable) return;
                ensureEditingAndExpanded();

                if (!chartConfig.dataset_id) {
                  updateChartConfig({
                    dataset_id: fallbackTable,
                    joined_tables: chartConfig.joined_tables?.length
                      ? chartConfig.joined_tables
                      : [fallbackTable],
                  });
                }

                const nextFilters = [
                  ...currentChartFilters,
                  { table: fallbackTable, field: "", op: "in", value: [] },
                ];
                const newKey = makeChartFilterKey(nextFilters.length - 1);
                clearFilterOptionsCache(newKey, "chart");
                syncChartFilters(nextFilters);
              };

              const updateFilterTable = (index: number, tableId: string) => {
                const targetTable = tableId || defaultFilterTable;
                const nextFilters = (tableConfig.filters || []).map((f, i) =>
                  i === index
                    ? { table: targetTable, field: "", op: getOp(f), value: "" }
                    : f
                );
                const key = makeTableFilterKey(index);
                clearFilterOptionsCache(key, "table");
                syncTableFilters(nextFilters);
              };

              const updateChartFilterTable = (
                index: number,
                tableId: string
              ) => {
                const targetTable = tableId || defaultFilterTable;
                const nextFilters = (chartConfig.filters || []).map((f, i) =>
                  i === index
                    ? { table: targetTable, field: "", op: getOp(f), value: [] }
                    : f
                );
                const key = makeChartFilterKey(index);
                clearFilterOptionsCache(key, "chart");
                syncChartFilters(nextFilters);
              };

              const updateFilterOperator = (index: number, op: string) => {
                const nextFilters = (tableConfig.filters || []).map((f, i) =>
                  i === index ? { ...f, op } : f
                );
                syncTableFilters(nextFilters);
              };

              const updateChartFilterOperator = (index: number, op: string) => {
                const nextFilters = (chartConfig.filters || []).map((f, i) =>
                  i === index ? { ...f, op } : f
                );
                syncChartFilters(nextFilters);
              };

              const updateFilterField = (
                index: number,
                tableId: string,
                field: string,
                filterKey: string
              ) => {
                const columnOnly = field.includes(".")
                  ? field.split(".").slice(-1)[0]
                  : field;
                const nextFilters = (tableConfig.filters || []).map((f, i) =>
                  i === index
                    ? { table: tableId, field, op: getOp(f), value: "" }
                    : f
                );
                clearFilterOptionsCache(filterKey, "table");
                syncTableFilters(nextFilters);

                if (tableId && columnOnly) {
                  fetchGroupByValues(
                    filterKey,
                    "table",
                    tableId,
                    columnOnly,
                    (values) =>
                      setGroupValueOptions((prev) => ({
                        ...prev,
                        [filterKey]: values,
                        [groupOptionsKey(filterKey, "table")]: values,
                      }))
                  ).catch(() => {
                    // If the backend responds 404 (dataset missing), keep the UI usable.
                    setGroupValueOptions((prev) => ({
                      ...prev,
                      [filterKey]: [],
                      [groupOptionsKey(filterKey, "table")]: [],
                    }));
                  });
                }
              };

              const updateChartFilterField = (
                index: number,
                tableId: string,
                field: string,
                filterKey: string
              ) => {
                const columnOnly = field.includes(".")
                  ? field.split(".").slice(-1)[0]
                  : field;
                const nextFilters = (chartConfig.filters || []).map((f, i) =>
                  i === index
                    ? { table: tableId, field, op: getOp(f), value: [] }
                    : f
                );
                clearFilterOptionsCache(filterKey, "chart");
                syncChartFilters(nextFilters);

                if (tableId && columnOnly) {
                  fetchGroupByValues(
                    filterKey,
                    "chart",
                    tableId,
                    columnOnly,
                    (values) =>
                      setGroupValueOptions((prev) => ({
                        ...prev,
                        [filterKey]: values,
                        [groupOptionsKey(filterKey, "chart")]: values,
                      }))
                  ).catch(() => {
                    setGroupValueOptions((prev) => ({
                      ...prev,
                      [filterKey]: [],
                      [groupOptionsKey(filterKey, "chart")]: [],
                    }));
                  });
                }
              };

              const updateFilterValue = (
                index: number,
                tableId: string,
                values: string | string[]
              ) => {
                const nextFilters = (tableConfig.filters || []).map((f, i) =>
                  i === index
                    ? {
                        table: tableId,
                        field: f.field || "",
                        op: getOp(f),
                        value: Array.isArray(values)
                          ? values
                          : [values].filter(Boolean),
                      }
                    : f
                );
                syncTableFilters(nextFilters);
              };

              const updateChartFilterValue = (
                index: number,
                tableId: string,
                values: string | string[]
              ) => {
                const nextFilters = (chartConfig.filters || []).map((f, i) =>
                  i === index
                    ? {
                        table: tableId,
                        field: f.field || "",
                        op: getOp(f),
                        value: Array.isArray(values)
                          ? values
                          : [values].filter(Boolean),
                      }
                    : f
                );
                syncChartFilters(nextFilters);
              };

              const removeFilterAt = (index: number, filterKey: string) => {
                const nextFilters = (tableConfig.filters || []).filter(
                  (_, i) => i !== index
                );
                setGroupValueOptions((prev) => {
                  const cacheKey = groupOptionsKey(filterKey, "table");
                  const {
                    [filterKey]: _omit,
                    [cacheKey]: _omit2,
                    ...rest
                  } = prev;
                  return rest;
                });
                syncTableFilters(nextFilters);
              };

              const removeChartFilterAt = (
                index: number,
                filterKey: string
              ) => {
                const nextFilters = (chartConfig.filters || []).filter(
                  (_, i) => i !== index
                );
                setGroupValueOptions((prev) => {
                  const cacheKey = groupOptionsKey(filterKey, "chart");
                  const {
                    [filterKey]: _omit,
                    [cacheKey]: _omit2,
                    ...rest
                  } = prev;
                  return rest;
                });
                syncChartFilters(nextFilters);
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
                          {(roleOptions.length ? roleOptions : []).map(
                            (role) => {
                              const checked = (w.roles || []).includes(role as UserRole);
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
                                        roles: (next.length
                                          ? next
                                          : roleOptions.slice(0, 1)) as UserRole[],
                                      });
                                    }}
                                    disabled={!isEditing}
                                  />
                                  {role.replace(/_/g, " ")}
                                </label>
                              );
                            }
                          )}
                          {!roleOptions.length && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              No roles defined
                            </span>
                          )}
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
                          {tableDataset ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                Fields (select and build list)
                              </p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    Select Table
                                  </label>
                                  <select
                                    value={primaryTableId}
                                    onChange={(e) => {
                                      const nextTable = e.target.value;
                                      const nextTables = Array.from(
                                        new Set([
                                          nextTable,
                                          ...(tableConfig.joined_tables || []),
                                        ])
                                      );
                                      updateTableConfig({
                                        dataset_id: nextTable,
                                        joined_tables: nextTables,
                                      });
                                    }}
                                    disabled={!isEditing}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  >
                                    {availableDatasets.map((ds) => (
                                      <option key={ds.id} value={ds.id}>
                                        {ds.table_name || ds.id}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    Select Field(s)
                                  </label>
                                  <select
                                    value=""
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      const next = Array.from(
                                        new Set([
                                          ...(tableConfig.fields || []),
                                          val,
                                        ])
                                      );
                                      updateTableConfig({ fields: next });
                                    }}
                                    disabled={!isEditing}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  >
                                    <option value="">
                                      Pick a field to add
                                    </option>
                                    {tableFieldOptions.map((col) => (
                                      <option
                                        key={col}
                                        value={col}
                                        className={
                                          (tableConfig.fields || []).includes(
                                            col
                                          )
                                            ? "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-100"
                                            : ""
                                        }
                                      >
                                        {displayFieldName(col)}
                                      </option>
                                    ))}
                                  </select>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                    Picking a field adds it to the list; remove
                                    using the buttons below.
                                  </p>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    Selected List
                                  </label>
                                  <div className="min-h-[120px] rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                                    {!tableConfig.fields?.length && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        No fields selected.
                                      </p>
                                    )}
                                    <div className="flex flex-col gap-1">
                                      {(tableConfig.fields || []).map(
                                        (field) => (
                                          <div
                                            key={field}
                                            className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                                          >
                                            <span className="truncate">
                                              {displayFieldName(field)}
                                            </span>
                                            <button
                                              type="button"
                                              className="text-rose-600 hover:text-rose-700 dark:text-rose-300"
                                              onClick={() => {
                                                const next = (
                                                  tableConfig.fields || []
                                                ).filter((f) => f !== field);
                                                updateTableConfig({
                                                  fields: next,
                                                });
                                              }}
                                              disabled={!isEditing}
                                              title="Remove field"
                                            >
                                              ✖
                                            </button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-200">
                              Select a table to pick fields.
                            </p>
                          )}

                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                Filters (WHERE clauses)
                              </label>
                              <button
                                type="button"
                                onClick={addTableFilter}
                                disabled={
                                  isSavingThis || !safeFilterTables.length
                                }
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                + Add Filter
                              </button>
                            </div>

                            {!currentTableFilters.length && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                No filters added.
                              </p>
                            )}

                            {currentTableFilters.map((flt, idx) => {
                              const filterKey = makeTableFilterKey(idx);
                              const cacheKey = groupOptionsKey(
                                filterKey,
                                "table"
                              );
                              const selectedTable =
                                flt.table || defaultFilterTable;
                              const tableColumns =
                                tableColumnsFor(selectedTable);
                              const valueOptions = Array.from(
                                new Set([
                                  ...(groupValueOptions[cacheKey] || []),
                                  ...(Array.isArray(flt.value)
                                    ? flt.value
                                    : flt.value
                                      ? [flt.value]
                                      : []),
                                ])
                              );
                              const isLoadingFilter =
                                groupValueLoading[cacheKey];

                              return (
                                <div
                                  key={`${idx}-${flt.field}-${flt.table || ""}`}
                                  className="grid w-full gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm sm:grid-cols-5 dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                      Table
                                    </span>
                                    <select
                                      value={selectedTable}
                                      onChange={(e) =>
                                        updateFilterTable(idx, e.target.value)
                                      }
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                      <option value="">Select table</option>
                                      {safeFilterTables.map((tbl) => {
                                        const ds = datasetLookup.get(tbl);
                                        return (
                                          <option key={tbl} value={tbl}>
                                            {ds?.table_name || tbl}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                      Field
                                    </span>
                                    <select
                                      value={flt.field || ""}
                                      onChange={(e) =>
                                        updateFilterField(
                                          idx,
                                          selectedTable,
                                          e.target.value,
                                          filterKey
                                        )
                                      }
                                      disabled={!selectedTable}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                      <option value="">Select field</option>
                                      {tableColumns.map((col) => (
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
                                      value={
                                        flt.op || (flt as any).operator || "in"
                                      }
                                      onChange={(e) =>
                                        updateFilterOperator(
                                          idx,
                                          e.target.value
                                        )
                                      }
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                      {operatorOptions.map((opt) => (
                                        <option
                                          key={opt.value}
                                          value={opt.value}
                                        >
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                      Values
                                    </span>
                                    <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                      {isLoadingFilter && (
                                        <span className="text-slate-500 dark:text-slate-400">
                                          Loading...
                                        </span>
                                      )}
                                      {!isLoadingFilter &&
                                        !valueOptions.length && (
                                          <span className="text-slate-500 dark:text-slate-400">
                                            No values
                                          </span>
                                        )}
                                      {valueOptions.map((val) => {
                                        const checked = Array.isArray(flt.value)
                                          ? flt.value.includes(val)
                                          : false;
                                        return (
                                          <label
                                            key={val}
                                            className={`flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm transition ${
                                              checked
                                                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              disabled={
                                                !selectedTable || !flt.field
                                              }
                                              onChange={(e) => {
                                                const current = Array.isArray(
                                                  flt.value
                                                )
                                                  ? flt.value
                                                  : [];
                                                const next = e.target.checked
                                                  ? [...current, val]
                                                  : current.filter(
                                                      (v) => v !== val
                                                    );
                                                updateFilterValue(
                                                  idx,
                                                  selectedTable,
                                                  next
                                                );
                                              }}
                                            />
                                            {val}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="flex items-end justify-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeFilterAt(idx, filterKey)
                                      }
                                      className="h-[38px] rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

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
                              }}
                              disabled={!isEditing}
                              className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              <option value="">None</option>
                              {(tableConfig.fields || []).map((col) => (
                                <option key={col} value={col}>
                                  {col}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                              Tables
                            </label>
                            <select
                              multiple
                              value={chartConfig.joined_tables || []}
                              onChange={(e) => {
                                const selected = Array.from(
                                  e.target.selectedOptions
                                ).map((opt) => opt.value);
                                const nextTables = selected.length
                                  ? selected
                                  : [primaryChartId].filter(Boolean);
                                const nextDataset =
                                  nextTables[0] || chartConfig.dataset_id || "";
                                updateChartConfig({
                                  joined_tables: nextTables,
                                  dataset_id: nextDataset,
                                });
                                const key = groupOptionsKey(widgetKey, "chart");
                                setGroupValueOptions((prev) => ({
                                  ...prev,
                                  [key]: [],
                                }));
                              }}
                              disabled={!isEditing}
                              className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                              {availableDatasets.map((ds) => (
                                <option key={ds.id} value={ds.id}>
                                  {ds.table_name || ds.id}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Hold Ctrl/Cmd to select multiple tables.
                            </p>
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
                            <div className="space-y-3">
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
                                    {chartFieldOptions.map((col) => (
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
                                    {chartFieldOptions.map((col) => (
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
                                    }}
                                    disabled={!isEditing}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  >
                                    <option value="">None</option>
                                    {(chartConfig.x_field || chartConfig.y_field
                                      ? [
                                          chartConfig.x_field,
                                          chartConfig.y_field,
                                        ].filter(Boolean)
                                      : chartFieldOptions
                                    ).map((col) => (
                                      <option key={col} value={col}>
                                        {col}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    Filters (WHERE clauses)
                                  </label>
                                  <button
                                    type="button"
                                    onClick={addChartFilter}
                                    disabled={
                                      isSavingThis || !safeFilterTables.length
                                    }
                                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                                  >
                                    + Add Filter
                                  </button>
                                </div>

                                {!currentChartFilters.length && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    No filters added.
                                  </p>
                                )}

                                {currentChartFilters.map((flt, idx) => {
                                  const filterKey = makeChartFilterKey(idx);
                                  const cacheKey = groupOptionsKey(
                                    filterKey,
                                    "chart"
                                  );
                                  const selectedTable =
                                    flt.table || defaultFilterTable;
                                  const tableColumns =
                                    tableColumnsFor(selectedTable);
                                  const selectedValues = Array.isArray(
                                    flt.value
                                  )
                                    ? flt.value
                                    : flt.value
                                      ? [flt.value]
                                      : [];
                                  const valueOptions = Array.from(
                                    new Set([
                                      ...(groupValueOptions[cacheKey] || []),
                                      ...(Array.isArray(flt.value)
                                        ? flt.value
                                        : flt.value
                                          ? [flt.value]
                                          : []),
                                    ])
                                  );
                                  const isLoadingFilter =
                                    groupValueLoading[cacheKey];

                                  return (
                                    <div
                                      key={`${idx}-${flt.field}-${flt.table || ""}`}
                                      className="grid w-full gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm sm:grid-cols-5 dark:border-slate-700 dark:bg-slate-900"
                                    >
                                      <div className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                          Table
                                        </span>
                                        <select
                                          value={selectedTable}
                                          onChange={(e) =>
                                            updateChartFilterTable(
                                              idx,
                                              e.target.value
                                            )
                                          }
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        >
                                          <option value="">Select table</option>
                                          {safeFilterTables.map((tbl) => {
                                            const ds = datasetLookup.get(tbl);
                                            return (
                                              <option key={tbl} value={tbl}>
                                                {ds?.table_name || tbl}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                          Field
                                        </span>
                                        <select
                                          value={flt.field || ""}
                                          onChange={(e) =>
                                            updateChartFilterField(
                                              idx,
                                              selectedTable,
                                              e.target.value,
                                              filterKey
                                            )
                                          }
                                          disabled={!selectedTable}
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        >
                                          <option value="">Select field</option>
                                          {tableColumns.map((col) => (
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
                                          value={
                                            flt.op ||
                                            (flt as any).operator ||
                                            "in"
                                          }
                                          onChange={(e) =>
                                            updateChartFilterOperator(
                                              idx,
                                              e.target.value
                                            )
                                          }
                                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        >
                                          {operatorOptions.map((opt) => (
                                            <option
                                              key={opt.value}
                                              value={opt.value}
                                            >
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                          Values
                                        </span>
                                        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                                          {isLoadingFilter && (
                                            <span className="text-slate-500 dark:text-slate-400">
                                              Loading...
                                            </span>
                                          )}
                                          {!isLoadingFilter &&
                                            !valueOptions.length && (
                                              <span className="text-slate-500 dark:text-slate-400">
                                                No values
                                              </span>
                                            )}
                                          {valueOptions.map((val) => {
                                            const checked =
                                              selectedValues.includes(val);
                                            return (
                                              <label
                                                key={val}
                                                className={`flex items-center gap-1 rounded-full border px-2 py-1 shadow-sm transition ${
                                                  checked
                                                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/30 dark:text-sky-100"
                                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  disabled={
                                                    !selectedTable || !flt.field
                                                  }
                                                  onChange={(e) => {
                                                    const current =
                                                      selectedValues;
                                                    const next = e.target
                                                      .checked
                                                      ? [...current, val]
                                                      : current.filter(
                                                          (v) => v !== val
                                                        );
                                                    updateChartFilterValue(
                                                      idx,
                                                      selectedTable,
                                                      next
                                                    );
                                                  }}
                                                />
                                                {val}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="flex items-end justify-end">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeChartFilterAt(idx, filterKey)
                                          }
                                          className="h-[38px] rounded-lg border border-rose-200 bg-white px-2 py-1 text-[11px] font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="space-y-1">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                  Quick Filter (optional)
                                </label>
                                <select
                                  value={chartConfig.filter_by || ""}
                                  onChange={(e) => {
                                    const col = e.target.value;
                                    const columnOnly = col.includes(".")
                                      ? col.split(".").slice(-1)[0]
                                      : col;
                                    const datasetForColumn = col.includes(".")
                                      ? col.split(".")[0]
                                      : chartConfig.dataset_id ||
                                        primaryChartId;
                                    updateChartConfig({
                                      filter_by: col,
                                      filter_values: [],
                                    });
                                    const key = filterOptionsKey(
                                      widgetKey,
                                      "chart"
                                    );
                                    setGroupValueOptions((prev) => ({
                                      ...prev,
                                      [key]: [],
                                    }));
                                    if (!col) return;
                                    fetchGroupByValues(
                                      `${widgetKey}-filter`,
                                      "chart",
                                      datasetForColumn || "",
                                      columnOnly,
                                      (values) =>
                                        updateChartConfig({
                                          filter_by: col,
                                          filter_values: values,
                                        })
                                    );
                                  }}
                                  disabled={!isEditing}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                >
                                  <option value="">None</option>
                                  {chartFieldOptions.map((col) => (
                                    <option key={col} value={col}>
                                      {col}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {chartConfig.filter_by && chartDataset && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                                    <span>Filter Values</span>
                                    {isChartFilterLoading && (
                                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                        Loading...
                                      </span>
                                    )}
                                    {!isChartFilterLoading &&
                                      !chartFilterOptions.length && (
                                        <span className="text-[11px] text-amber-600 dark:text-amber-200">
                                          No values found
                                        </span>
                                      )}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {chartFilterOptions.map((val) => {
                                      const checked =
                                        chartConfig.filter_values?.includes(
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
                                                chartConfig.filter_values || [];
                                              const next = checked
                                                ? current.filter(
                                                    (v) => v !== val
                                                  )
                                                : [...current, val];
                                              updateChartConfig({
                                                filter_values: next,
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
                            <p className="text-xs text-amber-600 dark:text-amber-200">
                              Select a dataset to configure chart axes.
                            </p>
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
