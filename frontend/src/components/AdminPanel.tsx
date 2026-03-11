import { useCallback, useEffect, useMemo, useState } from "react";
import UploadSection from "./admin/UploadSection";
import UserManagementSection from "./admin/UserManagementSection";
import DatasetManagementSection from "./admin/DatasetManagementSection";
import DashboardConfigSection from "./admin/DashboardConfigSection";
import BannerManagementSection from "./admin/BannerManagementSection";
import RoleManagementSection from "./admin/RoleManagementSection";
import type {
  ChartConfig,
  Dashboard,
  Dataset,
  ManagedUser,
  TableConfig,
  UserRole,
  Widget,
  WidgetType,
} from "./admin/types";
import { DEFAULT_ROLES } from "./admin/types";
import ResultTable from "./ResultTable";
import {
  BannerConfig,
  fetchValueCounts,
  persistBannerConfigs,
  readStoredBannerConfigs,
} from "./dashboard/bannerUtils";
import { buildFixedDatasets } from "./admin/fixedDatasets";
import { TABLE_TOTAL_COLUMN } from "./dashboard/bannerUtils";

type SectionId =
  | "upload"
  | "datasets"
  | "dashboard"
  | "banners"
  | "users"
  | "roles";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const withBase = (path: string) => {
  const trimmedBase = API_BASE.replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${trimmedBase}${path}`;
};

const DEFAULT_COLUMN_VALUES: Record<string, Record<string, string[]>> = {
  hcl_onboarding_status: {
    hcl_onboarding_status: ["InProgress", "Onboarded", "Hire Loss"],
  },
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
  const [roleOptions, setRoleOptions] = useState<UserRole[]>(DEFAULT_ROLES);
  const [rolesLoading, setRolesLoading] = useState(false);
  const normalizeRole = useCallback(
    (role: string) => (role || "").trim().toLowerCase(),
    []
  );
  const userRole: UserRole = useMemo(() => {
    const normalized = normalizeRole(authUserRole) as UserRole;
    if (normalized) return normalized;
    if (roleOptions.length) return roleOptions[0];
    return "leader";
  }, [authUserRole, normalizeRole, roleOptions]);
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
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
    null
  );
  const [dashboardSaving, setDashboardSaving] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [activeSection, setActiveSection] = useState<SectionId>("dashboard");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("leader");
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
  const [bannerConfigs, setBannerConfigs] = useState<BannerConfig[]>([]);
  const [columnCache, setColumnCache] = useState<Record<string, string[]>>({});

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${authToken}` }),
    [authToken]
  );

  const authedFetch = useCallback(
    async (path: string, options?: RequestInit) => {
      const headers = { ...(options?.headers || {}), ...authHeaders };
      return fetch(withBase(path), { ...options, headers });
    },
    [authHeaders]
  );

  const api = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
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
      if (res.status === 204) {
        return undefined as unknown as T;
      }
      const contentLength = res.headers.get("content-length");
      if (contentLength === "0") {
        return undefined as unknown as T;
      }
      return res.json();
    },
    [authedFetch]
  );

  const sections: { id: SectionId; label: string; hint?: string }[] =
    useMemo(() => {
      const base: { id: SectionId; label: string; hint?: string }[] = [
        { id: "upload", label: "Upload", hint: "Excel" },
        { id: "datasets", label: "Data Sets" },
        { id: "dashboard", label: "Dashboard Management" },
        { id: "banners", label: "Banner Management" },
      ];

      if (authUserRole === "admin") {
        base.push({ id: "users", label: "User Management" });
        base.push({ id: "roles", label: "Role Management" });
      }

      if (allowedSections && allowedSections.length) {
        return base.filter((s) => allowedSections.includes(s.id));
      }
      return base;
    }, [authUserRole, allowedSections]);

  const loadRoles = async () => {
    setRolesLoading(true);
    try {
      const data = await api<{ roles: string[] }>("/api/admin/roles");
      const names = Array.from(
        new Set((data.roles || []).map((r) => normalizeRole(r)))
      ).filter(Boolean) as UserRole[];
      setRoleOptions(names.length ? names : DEFAULT_ROLES);
    } catch (err) {
      if (userRole === "admin") {
        setError(err instanceof Error ? err.message : String(err));
      }
      setRoleOptions(DEFAULT_ROLES);
    } finally {
      setRolesLoading(false);
    }
  };

  const loadDatasets = async () => {
    setDatasetsLoading(true);
    setError(null);
    try {
      const data = await api<Dataset[]>("/api/admin/datasets");
      const merged = buildFixedDatasets(data || []);
      setDatasets(merged);
      if (merged.length) {
        const stillExists = merged.some((d) => d.id === selectedDatasetId);
        if (!stillExists) setSelectedDatasetId(merged[0].id);
      } else {
        setSelectedDatasetId("");
      }
    } finally {
      setDatasetsLoading(false);
    }
  };

  const loadDatasetColumns = async (datasetId: string): Promise<string[]> => {
    if (!datasetId) return [];
    if (columnCache[datasetId]?.length) return columnCache[datasetId];
    try {
      const data = await api<{ columns: string[] }>(
        `/api/admin/datasets/${encodeURIComponent(datasetId)}/columns`
      );
      const cols = data.columns || [];
      setColumnCache((prev) => ({ ...prev, [datasetId]: cols }));
      setDatasets((prev) =>
        prev.map((d) =>
          d.id === datasetId || d.table_name === datasetId
            ? { ...d, columns: cols }
            : d
        )
      );
      return cols;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  };

  const loadDashboards = async () => {
    setDashboardsLoading(true);
    setError(null);
    try {
      const data = await api<{ dashboards: Dashboard[] }>(
        "/api/admin/dashboards"
      );
      const list = data.dashboards || [];
      setDashboards(list);
      if (!list.length) {
        setSelectedDashboardId(null);
        setWidgets([]);
        return;
      }
      const targetId =
        userRole === "admin"
          ? selectedDashboardId &&
            list.some((d) => d.id === selectedDashboardId)
            ? selectedDashboardId
            : list[0].id
          : list.find((d) => d.id === "home")?.id || null;
      setSelectedDashboardId(targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDashboardsLoading(false);
    }
  };

  const loadWidgets = async (dashboardId?: string) => {
    setWidgetsLoading(true);
    try {
      const targetDashboardId =
        dashboardId || selectedDashboardId || dashboards[0]?.id || null;
      if (!targetDashboardId) {
        setWidgets([]);
        return;
      }
      const data = await api<{ widgets: Widget[] }>(
        `/api/admin/dashboard-config?dashboard_id=${encodeURIComponent(targetDashboardId)}`
      );
      const normalizedOptions = roleOptions.map(normalizeRole);
      const optionsSet = new Set(normalizedOptions);
      const normalized: Widget[] = (data.widgets || []).map((w) => {
        const incomingArray = Array.isArray(w.roles) ? w.roles : [];
        const safeRoles = incomingArray
          .map((r) => normalizeRole(r))
          .filter((r): r is UserRole => optionsSet.has(r));
        const adminDefault = normalizedOptions[0] || "admin";
        const finalRoles: UserRole[] =
          userRole === "admin"
            ? safeRoles.length
              ? safeRoles
              : ([adminDefault] as UserRole[])
            : [userRole];
        return {
          ...w,
          roles: finalRoles,
          dashboard_id: w.dashboard_id || targetDashboardId,
        };
      });
      const scoped =
        userRole === "admin"
          ? normalized
          : normalized.filter((w) =>
              (w.roles || []).map((r) => normalizeRole(r)).includes(userRole)
            );
      setWidgets(scoped as Widget[]);
      if (!selectedDashboardId) {
        setSelectedDashboardId(targetDashboardId);
      }
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
    if (userRole === "admin") {
      loadRoles();
    }
    loadDatasets();
    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userRole === "admin") return;
    const home = dashboards.find((d) => d.id === "home");
    if (home && selectedDashboardId !== home.id) {
      setSelectedDashboardId(home.id);
    }
  }, [dashboards, selectedDashboardId, userRole]);

  useEffect(() => {
    setBannerConfigs(readStoredBannerConfigs());
  }, []);

  useEffect(() => {
    if (selectedDashboardId) {
      loadWidgets(selectedDashboardId);
    } else {
      setWidgets([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDashboardId]);

  useEffect(() => {
    if (!sections.find((s) => s.id === activeSection) && sections[0]) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  useEffect(() => {
    if (!roleOptions.length) return;
    setNewUserRole((prev) =>
      prev && roleOptions.includes(prev) ? prev : roleOptions[0]
    );
  }, [roleOptions]);

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
    const isChart = widget.widget_type === "chart";
    const config = isChart ? getChartConfig(widget) : getTableConfig(widget);
    const datasetId = config.dataset_id || "";
    if (!datasetId) {
      setPreviewError("Select a dataset to preview.");
      setPreviewData(null);
      return;
    }

    const joined = new Set<string>(config.joined_tables || []);
    const collectPrefix = (val?: string) => {
      if (!val || !val.includes(".")) return;
      const prefix = val.split(".")[0];
      if (prefix && prefix !== datasetId) joined.add(prefix);
    };
    if (!isChart) {
      (config as TableConfig).fields?.forEach(collectPrefix);
    }
    collectPrefix(config.group_by);
    collectPrefix(config.filter_by);
    if (isChart) {
      collectPrefix((config as ChartConfig).x_field);
      collectPrefix((config as ChartConfig).y_field);
    }
    (config.filters || []).forEach((f) => {
      collectPrefix(f.field);
      if (f.table && f.table !== datasetId) joined.add(f.table);
    });
    const joinedTables = Array.from(joined);

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const filterQs = buildFilterQuery({
        ...config,
        joined_tables: joinedTables,
      });
      const limit = config.group_by ? 2000 : 50;
      const data = await api<{
        columns: string[];
        rows: Record<string, unknown>[];
      }>(`/api/admin/datasets/${datasetId}/records?limit=${limit}${filterQs}`);
      setPreviewData({ columns: data.columns || [], rows: data.rows || [] });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === "users") {
      loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

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
      const dashboardId = selectedDashboardId || dashboards[0]?.id || null;
      if (!dashboardId) {
        setError("Create a dashboard first.");
        return;
      }
      const fallbackDatasetId = selectedDatasetId || datasets[0]?.id || "";
      const payloadWidgets = list.map((w) => {
        const nextRoles =
          userRole === "admin"
            ? w.roles && w.roles.length
              ? w.roles
              : ["admin"]
            : [userRole];
        const baseConfig =
          w.widget_type === "chart" ? getChartConfig(w) : getTableConfig(w);
        const normalizedConfig = {
          ...baseConfig,
          dataset_id: baseConfig.dataset_id || fallbackDatasetId,
        };
        return {
          ...w,
          roles: nextRoles,
          config: normalizedConfig,
          dashboard_id: dashboardId,
        };
      });
      await api(`/api/admin/dashboard-config`, {
        method: "POST",
        body: JSON.stringify({
          widgets: payloadWidgets,
          dashboard_id: dashboardId,
        }),
      });
      await loadWidgets();
      setEditingWidgetId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWidgetId(null);
    }
  };

  const updateBannerConfigs = useCallback(
    (updater: (prev: BannerConfig[]) => BannerConfig[]) => {
      setBannerConfigs((prev) => {
        const next = updater(prev);
        persistBannerConfigs(next);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("banner-configs-changed"));
        }
        return next;
      });
    },
    []
  );

  const handleSaveBannerConfig = useCallback(
    (config: BannerConfig) => {
      updateBannerConfigs((prev) => {
        const existingIdx = prev.findIndex((b) => b.id === config.id);
        if (existingIdx !== -1) {
          const next = [...prev];
          next[existingIdx] = config;
          return next;
        }
        return [...prev, config];
      });
    },
    [updateBannerConfigs]
  );

  const handleDeleteBannerConfig = useCallback(
    (bannerId: string) => {
      updateBannerConfigs((prev) => prev.filter((b) => b.id !== bannerId));
    },
    [updateBannerConfigs]
  );

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
      joined_tables: base.joined_tables || [],
      fields: base.fields || [],
      group_by: base.group_by || "",
      group_by_values: base.group_by_values || [],
      filter_by: base.filter_by || "",
      filter_values: base.filter_values || [],
      filters: base.filters || [],
    };
  };

  const getChartConfig = (widget: Widget): ChartConfig => {
    const base = (widget.config as ChartConfig) || {};
    return {
      dataset_id: base.dataset_id || datasets[0]?.id || "",
      joined_tables: base.joined_tables || [],
      x_field: base.x_field || "",
      y_field: base.y_field || "",
      chart_type: base.chart_type || "bar",
      group_by: base.group_by || "",
      group_by_values: base.group_by_values || [],
      filter_by: base.filter_by || "",
      filter_values: base.filter_values || [],
      filters: base.filters || [],
    };
  };

  const getWidgetKey = (widget: Widget, index: number) =>
    widget.id || `tmp-${index}`;

  const groupOptionsKey = (widgetKey: string, type: WidgetType) =>
    `${type}-${widgetKey}`;

  const filterOptionsKey = (widgetKey: string, type: WidgetType) =>
    `${groupOptionsKey(widgetKey, type)}-filter`;

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
      const rawValues = data?.values || [];

      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const isAgeing = normalize(column) === "ageing_as_on_today";
      const isQuarterDate = normalize(column) === "jp_posting_date_to_hcl";

      const bucketAgeing = (vals: string[]) => {
        const buckets = new Set<string>();
        vals.forEach((v) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          if (n <= 30) buckets.add("0-30");
          else if (n <= 60) buckets.add("30-60");
          else if (n <= 90) buckets.add("60-90");
          else buckets.add("90+");
        });
        const order = ["0-30", "30-60", "60-90", "90+"];
        return order.filter((b) => buckets.has(b));
      };

      const quarterFromDate = (v: string) => {
        const parsed = new Date(v);
        if (Number.isNaN(parsed.getTime())) return null;
        const q = Math.floor(parsed.getMonth() / 3) + 1;
        if (q < 1 || q > 4) return null;
        return `Q${q}`;
      };

      const quarterValues = () => {
        const seen = new Set<string>();
        rawValues.forEach((v) => {
          const parsed = new Date(v);
          if (Number.isNaN(parsed.getTime())) return;
          const q = Math.floor(parsed.getMonth() / 3) + 1;
          const year = parsed.getFullYear();
          if (q < 1 || q > 4 || !Number.isFinite(year)) return;
          seen.add(`Q${q} ${year}`);
        });

        const ordered = Array.from(seen).sort((a, b) => {
          const [qa, ya] = a.split(" ");
          const [qb, yb] = b.split(" ");
          const qaNum = Number(qa.replace("Q", ""));
          const qbNum = Number(qb.replace("Q", ""));
          const yaNum = Number(ya);
          const ybNum = Number(yb);
          if (yaNum !== ybNum) return yaNum - ybNum;
          return qaNum - qbNum;
        });

        if (ordered.length) return ordered;

        const currentYear = new Date().getFullYear();
        return [
          `Q1 ${currentYear}`,
          `Q2 ${currentYear}`,
          `Q3 ${currentYear}`,
          `Q4 ${currentYear}`,
        ];
      };

      const dayRangeValues = () => ["0-30", "31-60", "61-90", "90+"];

      const values = isAgeing
        ? bucketAgeing(rawValues)
        : isQuarterDate
          ? [...quarterValues(), ...dayRangeValues()]
          : rawValues;

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

  const buildFilterQuery = (config: {
    filter_by?: string;
    filter_values?: string[];
    filters?: {
      table?: string;
      field?: string;
      op?: string;
      operator?: string;
      value?: string | string[];
    }[];
    joined_tables?: string[];
    dataset_id?: string;
  }) => {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const isDateBucket =
      normalize(config.filter_by || "") === "jp_posting_date_to_hcl";
    const vals = config.filter_values || [];
    const quarterPattern = /^Q[1-4](?:\s+\d{4})?$/i;
    const isQuarterVals = vals.every((v) => quarterPattern.test(v));
    const isDayRangeVals = vals.every(
      (v) => /^\d+\s*-\s*\d+$/.test(v) || /^\d+\+$/.test(v)
    );
    const skipServerFilter =
      config.filter_by &&
      vals.length &&
      isDateBucket &&
      (isQuarterVals || isDayRangeVals);
    const params = new URLSearchParams();
    if (config.filter_by && !skipServerFilter && vals.length) {
      params.set("filter_by", config.filter_by);
      (config.filter_values || []).forEach((v) =>
        params.append("filter_values", v)
      );
    }
    const joinSet = new Set((config.joined_tables || []).filter(Boolean));
    const baseTable = config.dataset_id || "";

    (config.filters || [])
      .filter(
        (f) => f.field && (Array.isArray(f.value) ? f.value.length : f.value)
      )
      .forEach((f) => {
        const prefix = f.table ? `${f.table}.` : "";
        if (f.table && f.table !== baseTable) {
          joinSet.add(f.table);
        }
        const rawValues = Array.isArray(f.value) ? f.value : [f.value];
        const values = rawValues
          .map((v) => String(v))
          .filter((v) => v.trim().length);
        if (!values.length) return;
        const op = (f.op || f.operator || "in").toLowerCase();
        const payload = {
          field: `${prefix}${f.field}`,
          table: f.table,
          op,
          values,
        };
        params.append("filters", JSON.stringify(payload));
      });
    Array.from(joinSet)
      .filter(Boolean)
      .forEach((t) => params.append("joined_tables", t));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
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

  const loadBannerColumnValues = useCallback(
    async (datasetId: string, column: string) => {
      if (column === TABLE_TOTAL_COLUMN) return [];
      const data = await api<{ values: string[] }>(
        `/api/admin/datasets/${datasetId}/columns/${encodeURIComponent(
          column
        )}/values`
      );
      const defaults =
        DEFAULT_COLUMN_VALUES[datasetId]?.[column] ||
        DEFAULT_COLUMN_VALUES[datasetId]?.[column.replace(/^.+\./, "") || ""] ||
        [];
      return Array.from(new Set([...(data.values || []), ...defaults]));
    },
    [api]
  );

  const loadBannerValueCounts = useCallback(
    async (
      datasetId: string,
      column: string,
      selectedValues?: string[],
      operator?: string,
      filters?: {
        table?: string;
        field: string;
        op?: string;
        values?: string[];
      }[]
    ) =>
      fetchValueCounts({
        apiBase: API_BASE,
        authToken,
        datasetId,
        column,
        filterOp: operator,
        filterValues: selectedValues,
        filters,
      }),
    [authToken]
  );

  const addWidget = (widgetType: WidgetType) => {
    const defaultDataset = selectedDatasetId || datasets[0]?.id || "";
    const activeDashboard =
      userRole === "admin"
        ? selectedDashboardId || dashboards[0]?.id || "default"
        : "home";
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

    setWidgets((prev) => [
      ...prev,
      {
        id: uid,
        dashboard_id: activeDashboard,
        title: widgetType === "table" ? "Table Widget" : "Chart Widget",
        widget_type: widgetType,
        order_index: prev.length,
        roles: [userRole === "admin" ? roleOptions[0] || "admin" : userRole],
        config: baseConfig,
      },
    ]);
    setPreviewWidgetId((prevId) => prevId || uid);
    setEditingWidgetId(uid);
  };

  const handleCreateDashboard = async (name: string, description?: string) => {
    if (userRole !== "admin") {
      setError("Only admins can create dashboards.");
      return;
    }
    if (!name.trim()) {
      setError("Dashboard name is required.");
      return;
    }
    setDashboardSaving(true);
    setError(null);
    try {
      const created = await api<Dashboard>("/api/admin/dashboards", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description || "",
        }),
      });
      await loadDashboards();
      setSelectedDashboardId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDashboardSaving(false);
    }
  };

  const handleUpdateDashboard = async (
    id: string,
    name: string,
    description?: string
  ) => {
    if (userRole !== "admin") return;
    if (!id) return;
    if (!name.trim()) {
      setError("Dashboard name is required.");
      return;
    }
    setDashboardSaving(true);
    setError(null);
    try {
      await api(`/api/admin/dashboards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          description: description || "",
        }),
      });
      await loadDashboards();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDashboardSaving(false);
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (userRole !== "admin") return;
    if (!id) return;
    setDashboardSaving(true);
    setError(null);
    try {
      await api(`/api/admin/dashboards/${id}`, { method: "DELETE" });
      await loadDashboards();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDashboardSaving(false);
    }
  };

  const handleReorderDashboard = async (
    dashboardId: string,
    direction: "up" | "down"
  ) => {
    if (userRole !== "admin") return;
    if (!dashboardId) return;
    setDashboardSaving(true);
    setError(null);
    const current = [...dashboards];
    const idx = current.findIndex((d) => d.id === dashboardId);
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || targetIdx < 0 || targetIdx >= current.length) {
      setDashboardSaving(false);
      return;
    }

    const reordered = [...current];
    [reordered[idx], reordered[targetIdx]] = [
      reordered[targetIdx],
      reordered[idx],
    ];
    const orderPayload = reordered.map((d) => d.id);

    try {
      await api("/api/admin/dashboards/reorder", {
        method: "POST",
        body: JSON.stringify({ order: orderPayload }),
      });
      setDashboards(reordered);
      setSelectedDashboardId(dashboardId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      await loadDashboards();
    } finally {
      setDashboardSaving(false);
    }
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
        const allowedRoles = new Set(roleOptions.map((r) => normalizeRole(r)));
        const requested = (
          patch.roles ??
          w.roles ?? [roleOptions[0] || "admin"]
        ).map((r) => normalizeRole(r));
        const filtered = requested.filter((r) =>
          allowedRoles.has(r)
        ) as UserRole[];
        const adminDefault = roleOptions[0] || "admin";
        const nextRoles =
          userRole === "admin"
            ? filtered.length
              ? filtered
              : [adminDefault]
            : [userRole];
        return { ...w, ...patch, roles: nextRoles as UserRole[] };
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

  const handleCreateRole = async (name: string) => {
    await api("/api/admin/roles", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await loadRoles();
  };

  const handleDeleteRole = async (name: string) => {
    await api(`/api/admin/roles/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    await loadRoles();
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
      setNewUserRole(roleOptions[0] || "leader");
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
          <UploadSection
            uploadFile={uploadFile}
            setUploadFile={setUploadFile}
            onUpload={handleUpload}
            uploading={uploading}
          />
        );
      case "datasets":
        return (
          <DatasetManagementSection
            datasets={datasets}
            datasetsLoading={datasetsLoading}
            actionLoading={actionLoading}
            onDeleteDataset={handleDelete}
            onClearAll={handleClearAll}
          />
        );
      case "users":
        return (
          <UserManagementSection
            users={users}
            usersLoading={usersLoading}
            newUserEmail={newUserEmail}
            setNewUserEmail={setNewUserEmail}
            newUserPassword={newUserPassword}
            setNewUserPassword={setNewUserPassword}
            newUserRole={newUserRole}
            setNewUserRole={setNewUserRole}
            roleOptions={roleOptions}
            onCreateUser={handleCreateUser}
            creatingUser={creatingUser}
            onRefreshUsers={loadUsers}
            editingUserId={editingUserId}
            setEditingUserId={setEditingUserId}
            editingPassword={editingPassword}
            setEditingPassword={setEditingPassword}
            onChangePassword={handleChangePassword}
            savingPassword={savingPassword}
            deletingUserId={deletingUserId}
            onDeleteUser={handleDeleteUser}
          />
        );
      case "roles":
        return (
          <RoleManagementSection
            roles={roleOptions}
            loading={rolesLoading}
            onCreateRole={handleCreateRole}
            onDeleteRole={handleDeleteRole}
          />
        );
      case "banners":
        return (
          <BannerManagementSection
            dashboards={
              userRole === "admin"
                ? dashboards
                : dashboards.filter((d) => d.id === "home")
            }
            selectedDashboardId={
              userRole === "admin" ? selectedDashboardId : "home"
            }
            datasets={datasets}
            bannerConfigs={bannerConfigs}
            onSaveBanner={handleSaveBannerConfig}
            onDeleteBanner={handleDeleteBannerConfig}
            loadColumns={loadDatasetColumns}
            loadColumnValues={loadBannerColumnValues}
            loadValueCounts={loadBannerValueCounts}
            userRole={userRole}
          />
        );
      case "dashboard":
      default:
        return (
          <DashboardConfigSection
            datasets={datasets}
            widgets={widgets}
            widgetsLoading={widgetsLoading}
            groupValueOptions={groupValueOptions}
            groupValueLoading={groupValueLoading}
            dashboards={
              userRole === "admin"
                ? dashboards
                : dashboards.filter((d) => d.id === "home")
            }
            dashboardsLoading={dashboardsLoading}
            selectedDashboardId={
              userRole === "admin" ? selectedDashboardId : "home"
            }
            onSelectDashboard={setSelectedDashboardId}
            onReorderDashboard={handleReorderDashboard}
            onCreateDashboard={handleCreateDashboard}
            onUpdateDashboard={handleUpdateDashboard}
            onDeleteDashboard={handleDeleteDashboard}
            dashboardSaving={dashboardSaving}
            editingWidgetId={editingWidgetId}
            savingWidgetId={savingWidgetId}
            showWidgetTypePicker={showWidgetTypePicker}
            setShowWidgetTypePicker={setShowWidgetTypePicker}
            pendingWidgetType={pendingWidgetType}
            setPendingWidgetType={setPendingWidgetType}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            previewWidgetId={previewWidgetId}
            setPreviewWidgetId={setPreviewWidgetId}
            previewData={previewData}
            previewLoading={previewLoading}
            previewError={previewError}
            userRole={userRole}
            roleOptions={roleOptions}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            onAddWidgetClick={handleAddWidgetClick}
            confirmAddWidget={confirmAddWidget}
            updateWidget={updateWidget}
            removeWidget={removeWidget}
            handleStartEditWidget={handleStartEditWidget}
            handleSaveWidget={handleSaveWidget}
            handleCancelEditWidget={handleCancelEditWidget}
            getWidgetKey={getWidgetKey}
            groupOptionsKey={groupOptionsKey}
            filterOptionsKey={filterOptionsKey}
            getTableConfig={getTableConfig}
            getChartConfig={getChartConfig}
            fetchGroupByValues={fetchGroupByValues}
            setGroupValueOptions={setGroupValueOptions}
            setError={setError}
            loadPreviewData={loadPreviewData}
            loadColumns={loadDatasetColumns}
          />
        );
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
