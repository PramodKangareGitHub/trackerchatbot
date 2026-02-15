import { useEffect, useMemo, useState } from "react";
import RecordsSection from "./admin/RecordsSection";
import UploadSection from "./admin/UploadSection";
import UserManagementSection from "./admin/UserManagementSection";
import DatasetManagementSection from "./admin/DatasetManagementSection";
import DashboardConfigSection from "./admin/DashboardConfigSection";
import type {
  ChartConfig,
  Dataset,
  ManagedUser,
  TableConfig,
  UserRole,
  Widget,
  WidgetType,
} from "./admin/types";
import { ROLE_OPTIONS } from "./admin/types";
import ResultTable from "./ResultTable";

type SectionId = "upload" | "datasets" | "records" | "dashboard" | "users";

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
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            onDeleteDataset={handleDelete}
            onClearAll={handleClearAll}
          />
        );
      case "records":
        return (
          <RecordsSection
            selectedDataset={selectedDataset}
            recordDraft={recordDraft}
            setRecordDraft={setRecordDraft}
            onAddRecord={handleAddRecord}
            records={records}
            recordsLoading={recordsLoading}
            editRowId={editRowId}
            setEditRowId={setEditRowId}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onUpdateRecord={handleUpdateRecord}
            onDeleteRecord={handleDeleteRecord}
            recordsPage={recordsPage}
            recordsTotal={recordsTotal}
            pageSize={pageSize}
            onPageChange={(page) => loadRecords(page)}
            onExport={handleExport}
            onRefresh={() => loadRecords(recordsPage)}
            actionLoading={actionLoading}
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
      case "dashboard":
      default:
        return (
          <DashboardConfigSection
            datasets={datasets}
            widgets={widgets}
            widgetsLoading={widgetsLoading}
            groupValueOptions={groupValueOptions}
            groupValueLoading={groupValueLoading}
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
            onAddWidgetClick={handleAddWidgetClick}
            confirmAddWidget={confirmAddWidget}
            updateWidget={updateWidget}
            removeWidget={removeWidget}
            handleStartEditWidget={handleStartEditWidget}
            handleSaveWidget={handleSaveWidget}
            handleCancelEditWidget={handleCancelEditWidget}
            getWidgetKey={getWidgetKey}
            groupOptionsKey={groupOptionsKey}
            getTableConfig={getTableConfig}
            getChartConfig={getChartConfig}
            fetchGroupByValues={fetchGroupByValues}
            setGroupValueOptions={setGroupValueOptions}
            setError={setError}
            loadPreviewData={loadPreviewData}
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
