import { useEffect, useMemo, useState } from "react";
import ResultTable from "./ResultTable";

type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  row_count: number;
  columns: string[];
  created_at?: string;
};

type UserRole = "admin" | "developer" | "leader" | "delivery_manager";

type Widget = {
  id?: string;
  title: string;
  widget_type?: WidgetType | null;
  order_index?: number | null;
  roles?: UserRole[];
  config?: TableConfig | ChartConfig;
};

type WidgetType = "table" | "chart";

type TableConfig = {
  dataset_id?: string;
  fields?: string[];
  group_by?: string;
  group_by_values?: string[];
};

type ChartConfig = {
  dataset_id?: string;
  x_field?: string;
  y_field?: string;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_values?: string[];
};

type PreviewTableProps = {
  tableConfig: TableConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

type PreviewChartProps = {
  widgetTitle?: string;
  chartConfig: ChartConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
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

    // Build column list: user-selected fields (fallback to dataset columns)
    const baseColumns = tableConfig.fields?.length
      ? tableConfig.fields
      : data.columns;
    const columns = baseColumns.filter((c) => c); // drop falsy

    // Ensure group column present only when we want to show it
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

    const rows = Array.from(grouped.values()).map(({ count, row }) => {
      return { ...row, count };
    });

    return (
      <ResultTable
        columns={finalColumns}
        rows={rows}
        showChartToggle={false}
        showCsvDownload={false}
      />
    );
  }

  // Ungrouped preview: show selected fields (or all columns) and first rows
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

  // When Y is non-numeric, fall back to counting rows so the Y bar still renders.
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
    // For pie, prefer numeric Y series; otherwise use counts
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

  // Bar / line preview (rendered as grouped bars for simplicity)
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

type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
};

type SectionId = "upload" | "datasets" | "records" | "dashboard" | "users";

const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "developer",
  "leader",
  "delivery_manager",
];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const withBase = (path: string) => {
  const trimmedBase = API_BASE.replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${trimmedBase}${path}`;
};

type AdminPanelProps = {
  authToken: string;
  authUserRole: string;
  allowedSections?: SectionId[];
};

const AdminPanel = ({
  authToken,
  authUserRole,
  allowedSections,
}: AdminPanelProps) => {
  const userRole: UserRole = ROLE_OPTIONS.includes(authUserRole as UserRole)
    ? (authUserRole as UserRole)
    : "leader";
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [widgetsLoading, setWidgetsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedDatasetId),
    [datasets, selectedDatasetId]
  );

  const [recordDraft, setRecordDraft] = useState<Record<string, string>>({});
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsPage, setRecordsPage] = useState(0);
  const pageSize = 20;
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown>>({});
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<
    "admin" | "developer" | "leader" | "delivery_manager"
  >("leader");
  const [creatingUser, setCreatingUser] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showWidgetTypePicker, setShowWidgetTypePicker] = useState(false);
  const [pendingWidgetType, setPendingWidgetType] =
    useState<WidgetType>("table");
  const [showPreview, setShowPreview] = useState(false);
  const [previewWidgetId, setPreviewWidgetId] = useState<string | null>(null);
  const [groupValueOptions, setGroupValueOptions] = useState<
    Record<string, string[]>
  >({});
  const [groupValueLoading, setGroupValueLoading] = useState<
    Record<string, boolean>
  >({});
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [savingWidgetId, setSavingWidgetId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${authToken}` }),
    [authToken]
  );

  const authedFetch = async (path: string, options?: RequestInit) => {
    const headers = { ...(options?.headers || {}), ...authHeaders };
    return fetch(withBase(path), { ...options, headers });
  };

  const api = async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const res = await authedFetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || res.statusText || "Request failed");
    }
    // Handle no-content responses (e.g., DELETE 204) gracefully
    if (res.status === 204) {
      return undefined as unknown as T;
    }
    const contentLength = res.headers.get("content-length");
    if (contentLength === "0") {
      return undefined as unknown as T;
    }
    return res.json();
  };

  const sections: { id: SectionId; label: string; hint?: string }[] =
    useMemo(() => {
      const base: { id: SectionId; label: string; hint?: string }[] = [
        { id: "upload", label: "Upload", hint: "Excel" },
        { id: "datasets", label: "Data Management" },
        { id: "records", label: "Add / Update Records" },
        { id: "dashboard", label: "Dashboard" },
      ];

      if (authUserRole === "admin") {
        base.push({ id: "users", label: "User Management" });
      }

      if (allowedSections && allowedSections.length) {
        return base.filter((s) => allowedSections.includes(s.id));
      }
      return base;
    }, [authUserRole, allowedSections]);

  const loadDatasets = async () => {
    setDatasetsLoading(true);
    setError(null);
    try {
      const data = await api<Dataset[]>("/api/admin/datasets");
      setDatasets(data);
      if (data.length) {
        const stillExists = data.some((d) => d.id === selectedDatasetId);
        if (!stillExists) setSelectedDatasetId(data[0].id);
      } else {
        setSelectedDatasetId("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDatasetsLoading(false);
    }
  };

  const loadWidgets = async () => {
    setWidgetsLoading(true);
    try {
      const data = await api<{ widgets: Widget[] }>(
        "/api/admin/dashboard-config"
      );
      const normalized: Widget[] = (data.widgets || []).map((w) => {
        const incomingArray = Array.isArray(w.roles) ? w.roles : [];
        const safeRoles = incomingArray.filter((r): r is UserRole =>
          ROLE_OPTIONS.includes(r as UserRole)
        );
        const finalRoles: UserRole[] =
          userRole === "admin"
            ? safeRoles.length
              ? safeRoles
              : ["admin"]
            : [userRole];
        return { ...w, roles: finalRoles };
      });
      const scoped =
        userRole === "admin"
          ? normalized
          : normalized.filter((w) => (w.roles || []).includes(userRole));
      setWidgets(scoped as Widget[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWidgetsLoading(false);
    }
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setError(null);
    try {
      const data = await api<ManagedUser[]>("/api/auth/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
    loadWidgets();
  }, []);

  useEffect(() => {
    if (!sections.find((s) => s.id === activeSection) && sections[0]) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  useEffect(() => {
    if (!widgets.length) {
      setPreviewWidgetId(null);
      return;
    }
    const currentMatch = widgets.find((w, idx) => {
      const key = w.id || `tmp-${idx}`;
      return key === previewWidgetId;
    });
    if (!currentMatch) {
      const firstKey = widgets[0].id || "tmp-0";
      setPreviewWidgetId(firstKey);
    }
  }, [widgets, previewWidgetId]);

  useEffect(() => {
    if (!showPreview) return;
    const widget = widgets.find(
      (w, idx) => getWidgetKey(w, idx) === previewWidgetId
    );
    if (!widget) return;
    loadPreviewData(widget);
  }, [showPreview, previewWidgetId, widgets]);

  const loadPreviewData = async (widget: Widget | undefined) => {
    if (!widget) return;
    const config =
      widget.widget_type === "chart"
        ? getChartConfig(widget)
        : getTableConfig(widget);
    const datasetId = config.dataset_id || "";
    if (!datasetId) {
      setPreviewError("Select a dataset to preview.");
      setPreviewData(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await api<{
        columns: string[];
        rows: Record<string, unknown>[];
      }>(`/api/admin/datasets/${datasetId}/records?limit=50`);
      setPreviewData({ columns: data.columns || [], rows: data.rows || [] });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDataset) {
      const draft: Record<string, string> = {};
      selectedDataset.columns.forEach((c) => {
        draft[c] = "";
      });
      setRecordDraft(draft);
      setEditRowId(null);
      setEditDraft({});
    }
  }, [selectedDataset]);

  useEffect(() => {
    if (activeSection === "records") {
      loadRecords(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, selectedDataset]);

  useEffect(() => {
    if (activeSection === "users") {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const loadRecords = async (page = 0) => {
    if (!selectedDataset) return;
    setRecordsLoading(true);
    setError(null);
    try {
      const data = await api<{
        columns: string[];
        rows: Record<string, unknown>[];
        total: number;
      }>(
        `/api/admin/datasets/${
          selectedDataset.id
        }/records?limit=${pageSize}&offset=${page * pageSize}`
      );
      setRecords(data.rows || []);
      setRecordsTotal(data.total || 0);
      setRecordsPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleAddRecord = async () => {
    if (!selectedDataset) return;
    try {
      setActionLoading(true);
      await api(`/api/admin/datasets/${selectedDataset.id}/records`, {
        method: "POST",
        body: JSON.stringify({ records: [recordDraft] }),
      });
      await loadDatasets();
      await loadRecords(recordsPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRecord = async () => {
    if (!selectedDataset || editRowId === null) return;
    try {
      setActionLoading(true);
      await api(
        `/api/admin/datasets/${selectedDataset.id}/records/${editRowId}`,
        {
          method: "PUT",
          body: JSON.stringify({ record: editDraft }),
        }
      );
      setEditRowId(null);
      setEditDraft({});
      await loadDatasets();
      await loadRecords(recordsPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRecord = async (rowid: number) => {
    if (!selectedDataset) return;
    try {
      setActionLoading(true);
      await api(`/api/admin/datasets/${selectedDataset.id}/records/${rowid}`, {
        method: "DELETE",
      });
      await loadDatasets();
      const nextPage = recordsPage;
      await loadRecords(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedDataset) return;
    try {
      const res = await authedFetch(
        `/api/admin/datasets/${selectedDataset.id}/export`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${
        selectedDataset.original_file_name ||
        selectedDataset.table_name ||
        "dataset"
      }.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setError("Select an Excel file first");
      return;
    }
    setError(null);
    setUploadMessage(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);

      const res = await authedFetch("/api/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Upload failed");
      }

      const data: Dataset = await res.json();
      setUploadMessage(
        `Uploaded ${data.original_file_name || uploadFile.name}`
      );
      setUploadFile(null);
      await loadDatasets();
      setSelectedDatasetId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setActionLoading(true);
      await api(`/api/admin/datasets/${id}`, { method: "DELETE" });
      await loadDatasets();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setActionLoading(true);
      await api(`/api/admin/datasets`, { method: "DELETE" });
      await loadDatasets();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const persistWidgets = async (list: Widget[], savingKey: string) => {
    try {
      setSavingWidgetId(savingKey);
      const payloadWidgets = list.map((w) => {
        const nextRoles =
          userRole === "admin"
            ? w.roles && w.roles.length
              ? w.roles
              : ["admin"]
            : [userRole];
        return { ...w, roles: nextRoles };
      });
      await api(`/api/admin/dashboard-config`, {
        method: "POST",
        body: JSON.stringify({ widgets: payloadWidgets }),
      });
      await loadWidgets();
      setEditingWidgetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWidgetId(null);
    }
  };

  const handleSaveWidget = async (widgetKey: string) => {
    await persistWidgets(widgets, widgetKey);
  };

  const handleStartEditWidget = (widgetKey: string) => {
    setEditingWidgetId(widgetKey);
  };

  const handleCancelEditWidget = async () => {
    setEditingWidgetId(null);
    await loadWidgets();
  };

  const getTableConfig = (widget: Widget): TableConfig => {
    const base = (widget.config as TableConfig) || {};
    return {
      dataset_id: base.dataset_id || datasets[0]?.id || "",
      fields: base.fields || [],
      group_by: base.group_by || "",
      group_by_values: base.group_by_values || [],
    };
  };

  const getChartConfig = (widget: Widget): ChartConfig => {
    const base = (widget.config as ChartConfig) || {};
    return {
      dataset_id: base.dataset_id || datasets[0]?.id || "",
      x_field: base.x_field || "",
      y_field: base.y_field || "",
      chart_type: base.chart_type || "bar",
      group_by: base.group_by || "",
      group_by_values: base.group_by_values || [],
    };
  };

  const getWidgetKey = (widget: Widget, index: number) =>
    widget.id || `tmp-${index}`;

  const groupOptionsKey = (widgetKey: string, type: WidgetType) =>
    `${type}-${widgetKey}`;

  const fetchGroupByValues = async (
    widgetKey: string,
    type: WidgetType,
    datasetId: string,
    column: string,
    onValues: (values: string[]) => void
  ) => {
    const key = groupOptionsKey(widgetKey, type);
    if (!datasetId || !column) {
      setGroupValueOptions((prev) => ({ ...prev, [key]: [] }));
      onValues([]);
      return;
    }
    setGroupValueLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const data = await api<{ values: string[] }>(
        `/api/admin/datasets/${datasetId}/columns/${encodeURIComponent(
          column
        )}/values`
      );
      const values = data?.values || [];
      setGroupValueOptions((prev) => ({ ...prev, [key]: values }));
      onValues(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setGroupValueOptions((prev) => ({ ...prev, [key]: [] }));
      onValues([]);
    } finally {
      setGroupValueLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Ensure saved group-by selections repopulate their distinct value lists on load
  useEffect(() => {
    widgets.forEach((w, idx) => {
      const widgetType: WidgetType = (w.widget_type as WidgetType) || "table";
      const widgetKey = getWidgetKey(w, idx);
      const optionsKey = groupOptionsKey(widgetKey, widgetType);
      const hasOptions = (groupValueOptions[optionsKey] || []).length > 0;
      const isLoading = groupValueLoading[optionsKey];

      if (isLoading || hasOptions) return;

      if (widgetType === "table") {
        const cfg = getTableConfig(w);
        if (cfg.group_by && cfg.dataset_id) {
          fetchGroupByValues(
            widgetKey,
            "table",
            cfg.dataset_id,
            cfg.group_by,
            () => {}
          );
        }
      } else {
        const cfg = getChartConfig(w);
        if (cfg.group_by && cfg.dataset_id) {
          fetchGroupByValues(
            widgetKey,
            "chart",
            cfg.dataset_id,
            cfg.group_by,
            () => {}
          );
        }
      }
    });
  }, [widgets, groupValueOptions, groupValueLoading]);

  const addWidget = (widgetType: WidgetType) => {
    const defaultDataset = datasets[0]?.id || "";
    const uid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `widget-${Date.now()}`;

    const baseConfig: TableConfig | ChartConfig =
      widgetType === "table"
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

    setWidgets((prev) => [
      ...prev,
      {
        id: uid,
        title: widgetType === "table" ? "Table Widget" : "Chart Widget",
        widget_type: widgetType,
        order_index: prev.length,
        roles: [userRole === "admin" ? "admin" : userRole],
        config: baseConfig,
      },
    ]);
    setPreviewWidgetId((prevId) => prevId || uid);
    setEditingWidgetId(uid);
  };

  const handleAddWidgetClick = () => {
    setPendingWidgetType("table");
    setShowWidgetTypePicker(true);
  };

  const confirmAddWidget = () => {
    addWidget(pendingWidgetType);
    setShowWidgetTypePicker(false);
  };

  const updateWidget = (idx: number, patch: Partial<Widget>) => {
    setWidgets((prev) =>
      prev.map((w, i) => {
        if (i !== idx) return w;
        const nextRoles =
          userRole === "admin"
            ? (patch.roles ?? w.roles ?? ["admin"])
            : [userRole];
        return { ...w, ...patch, roles: nextRoles };
      })
    );
  };

  const removeWidget = async (idx: number) => {
    const next = widgets.filter((_, i) => i !== idx);
    setWidgets(next);
    const removedCurrent =
      previewWidgetId &&
      idx < widgets.length &&
      getWidgetKey(widgets[idx], idx) === previewWidgetId;
    if (removedCurrent && next.length) {
      const newKey = getWidgetKey(next[0], 0);
      setPreviewWidgetId(newKey);
    }
    await persistWidgets(next, "remove");
  };

  const handleCreateUser = async () => {
    setError(null);
    setCreatingUser(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("leader");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingUser(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editingUserId || !editingPassword) return;
    setError(null);
    setSavingPassword(true);
    try {
      await api(`/api/auth/users/${editingUserId}/password`, {
        method: "POST",
        body: JSON.stringify({ new_password: editingPassword }),
      });
      setEditingUserId(null);
      setEditingPassword("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) return;
    setError(null);
    setDeletingUserId(userId);
    try {
      await api(`/api/auth/users/${userId}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingUserId(null);
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case "upload":
        return (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Upload Excel
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                .xlsx or .xls
              </span>
            </div>
            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-4">
              <label className="flex flex-1 cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-slate-700 shadow-inner transition hover:border-sky-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <span className="font-medium">Choose file</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {uploadFile ? uploadFile.name : "Drop or pick an Excel file"}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setUploadFile(file ?? null);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              After upload, the dataset becomes available for chat and record
              insertions.
            </p>
          </section>
        );
      case "datasets":
        return (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Dataset Management
              </h3>
              <button
                type="button"
                onClick={handleClearAll}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
                disabled={actionLoading || datasetsLoading}
              >
                Clear All Datasets
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {(datasetsLoading || actionLoading) && (
                <p className="text-slate-500 dark:text-slate-400">Loading…</p>
              )}
              {!datasetsLoading && !datasets.length && (
                <p className="text-slate-500 dark:text-slate-400">
                  No datasets yet.
                </p>
              )}
              {!datasetsLoading && datasets.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {datasets.map((ds) => (
                    <li
                      key={ds.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {ds.original_file_name || ds.table_name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {ds.row_count} rows • {ds.columns.length} columns
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDatasetId(ds.id)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm ${
                            selectedDatasetId === ds.id
                              ? "bg-sky-600 text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ds.id)}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                          disabled={actionLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        );
      case "records":
        return (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Add / Update Records
                </h3>
                {selectedDataset && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedDataset.table_name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadRecords(recordsPage)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  disabled={recordsLoading || !selectedDataset}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  disabled={!selectedDataset}
                >
                  Export CSV
                </button>
              </div>
            </div>
            {!selectedDataset && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a dataset to add records.
              </p>
            )}
            {selectedDataset && (
              <div className="space-y-3 text-sm">
                {selectedDataset.columns.map((col) => (
                  <div key={col} className="flex items-center gap-3">
                    <label className="w-32 text-right font-medium text-slate-700 dark:text-slate-200">
                      {col}
                    </label>
                    <input
                      value={recordDraft[col] ?? ""}
                      onChange={(e) =>
                        setRecordDraft((prev) => ({
                          ...prev,
                          [col]: e.target.value,
                        }))
                      }
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                ))}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleAddRecord}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                    disabled={actionLoading}
                  >
                    Add Record
                  </button>
                </div>
                <div className="mt-6 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex min-w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-100">
                    <span>Rows</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Page {recordsPage + 1} • {recordsTotal} total
                    </span>
                  </div>
                  <div className="min-w-full max-h-[60vh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-xs uppercase tracking-wide text-slate-400">
                            rowid
                          </th>
                          {selectedDataset.columns.map((col) => (
                            <th key={col} className="px-3 py-2 font-semibold">
                              {col}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {recordsLoading && (
                          <tr>
                            <td
                              colSpan={selectedDataset.columns.length + 2}
                              className="px-3 py-3 text-center text-slate-500 dark:text-slate-400"
                            >
                              Loading…
                            </td>
                          </tr>
                        )}
                        {!recordsLoading && !records.length && (
                          <tr>
                            <td
                              colSpan={selectedDataset.columns.length + 2}
                              className="px-3 py-3 text-center text-slate-500 dark:text-slate-400"
                            >
                              No records yet.
                            </td>
                          </tr>
                        )}
                        {!recordsLoading &&
                          records.map((row) => {
                            const rid = Number(row.rowid ?? row.rowid ?? 0);
                            const isEditing = editRowId === rid;
                            return (
                              <tr
                                key={rid}
                                className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                              >
                                <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                                  {rid}
                                </td>
                                {selectedDataset.columns.map((col) => (
                                  <td
                                    key={col}
                                    className="px-3 py-2 text-slate-800 dark:text-slate-100"
                                  >
                                    {isEditing ? (
                                      <input
                                        value={String(
                                          (editDraft[col] ??
                                            row[col] ??
                                            "") as string
                                        )}
                                        onChange={(e) =>
                                          setEditDraft((prev) => ({
                                            ...prev,
                                            [col]: e.target.value,
                                          }))
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                      />
                                    ) : (
                                      <span>{String(row[col] ?? "")}</span>
                                    )}
                                  </td>
                                ))}
                                <td className="px-3 py-2 text-right text-sm">
                                  {isEditing ? (
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditRowId(null);
                                          setEditDraft({});
                                        }}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleUpdateRecord}
                                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                                        disabled={actionLoading}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditRowId(rid);
                                          setEditDraft(
                                            selectedDataset.columns.reduce<
                                              Record<string, unknown>
                                            >((acc, col) => {
                                              acc[col] = row[col];
                                              return acc;
                                            }, {})
                                          );
                                        }}
                                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRecord(rid)}
                                        className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-100"
                                        disabled={actionLoading}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => loadRecords(Math.max(0, recordsPage - 1))}
                      disabled={recordsPage === 0 || recordsLoading}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      Prev
                    </button>
                    <span>
                      Page {recordsPage + 1} of{" "}
                      {Math.max(1, Math.ceil(recordsTotal / pageSize))}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadRecords(recordsPage + 1)}
                      disabled={
                        (recordsPage + 1) * pageSize >= recordsTotal ||
                        recordsLoading
                      }
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      case "users":
        return (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Create User
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Leader / Delivery Manager / Admin / Developer
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Password
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Set a password"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) =>
                    setNewUserRole(
                      e.target.value as
                        | "admin"
                        | "developer"
                        | "leader"
                        | "delivery_manager"
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="leader">Leader</option>
                  <option value="delivery_manager">Delivery Manager</option>
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                New users must log in with the email/password you set.
              </p>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={creatingUser || !newUserEmail || !newUserPassword}
                className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
              >
                {creatingUser ? "Creating…" : "Create user"}
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                  Existing users
                </h4>
                <button
                  type="button"
                  onClick={loadUsers}
                  className="text-xs text-sky-600 underline hover:text-sky-700 dark:text-sky-300"
                >
                  Refresh
                </button>
              </div>
              {usersLoading && (
                <p className="text-slate-500 dark:text-slate-400">
                  Loading users…
                </p>
              )}
              {!usersLoading && !users.length && (
                <p className="text-slate-500 dark:text-slate-400">
                  No users yet.
                </p>
              )}
              {!usersLoading && users.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          Email
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          Role
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          Created
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                            {u.email}
                          </td>
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                            {u.role.replace(/_/g, " ")}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleString()
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                              <div className="flex-1">
                                {u.role === "leader" ||
                                u.role === "delivery_manager" ? (
                                  editingUserId === u.id ? (
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                      <input
                                        type="password"
                                        value={editingPassword}
                                        onChange={(e) =>
                                          setEditingPassword(e.target.value)
                                        }
                                        className="w-full min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        placeholder="New password"
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={handleChangePassword}
                                          disabled={
                                            savingPassword || !editingPassword
                                          }
                                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                          {savingPassword ? "Saving…" : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingUserId(null);
                                            setEditingPassword("");
                                          }}
                                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUserId(u.id);
                                        setEditingPassword("");
                                      }}
                                      className="text-xs font-semibold text-sky-600 underline hover:text-sky-700 dark:text-sky-300"
                                    >
                                      Change password
                                    </button>
                                  )
                                ) : (
                                  <span className="text-xs text-slate-500">
                                    N/A
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={deletingUserId === u.id}
                                className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:border-rose-300 hover:text-rose-800 disabled:opacity-60 dark:border-rose-600 dark:bg-slate-900 dark:text-rose-200"
                              >
                                {deletingUserId === u.id
                                  ? "Deleting…"
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      case "dashboard":
      default: {
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
                  onClick={handleAddWidgetClick}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Add Widget
                </button>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {widgetsLoading && (
                <p className="text-slate-500 dark:text-slate-400">
                  Loading widgets…
                </p>
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
                              handleWidgetTypeChange(
                                e.target.value as WidgetType
                              )
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
                              (w, idx) =>
                                getWidgetKey(w, idx) === previewWidgetId
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
      }
    }
  };

  return (
    <div className="w-full px-2 md:px-3 lg:px-4">
      <div className="grid gap-3 lg:grid-cols-[240px,1fr]">
        <aside className="h-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-800/70">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {authUserRole === "developer" ? "Developer" : "Admin"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage datasets and dashboards
            </p>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            {sections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-left font-semibold shadow-sm transition ${
                    active
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  }`}
                  aria-pressed={active}
                >
                  <span>{section.label}</span>
                  {section.hint && !active && (
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">
                      {section.hint}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {sections.find((s) => s.id === activeSection)?.label || "Admin"}
            </h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Manage datasets, records, and dashboard widgets.
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
              {error}
            </div>
          )}

          {uploadMessage && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100">
              {uploadMessage}
            </div>
          )}

          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
