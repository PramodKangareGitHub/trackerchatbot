import { useEffect, useMemo, useState } from "react";

type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  row_count: number;
  columns: string[];
  created_at?: string;
};

type Widget = {
  id?: string;
  title: string;
  widget_type?: string | null;
  order_index?: number | null;
  config?: Record<string, unknown>;
};

type ManagedUser = {
  id: string;
  email: string;
  role: string;
  created_at?: string;
};

type SectionId = "upload" | "datasets" | "records" | "dashboard" | "users";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const withBase = (path: string) => {
  const trimmedBase = API_BASE.replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${trimmedBase}${path}`;
};

type AdminPanelProps = {
  authToken: string;
  authUserRole: string;
};

const AdminPanel = ({ authToken, authUserRole }: AdminPanelProps) => {
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
  const [savingWidgets, setSavingWidgets] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("upload");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<
    "viewer" | "admin" | "developer"
  >("viewer");
  const [creatingUser, setCreatingUser] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingPassword, setEditingPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
    return res.json();
  };

  const sections: { id: SectionId; label: string; hint?: string }[] = [
    { id: "upload", label: "Upload", hint: "Excel" },
    { id: "datasets", label: "Data Management" },
    { id: "records", label: "Add / Update Records" },
    { id: "dashboard", label: "Dashboard" },
  ];

  if (authUserRole === "admin") {
    sections.push({ id: "users", label: "User Management" });
  }

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
      setWidgets(data.widgets || []);
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
    if (activeSection === "users" && authUserRole === "admin") {
      loadUsers();
    }
  }, [activeSection, authUserRole]);

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

  const handleSaveWidgets = async () => {
    try {
      setSavingWidgets(true);
      await api(`/api/admin/dashboard-config`, {
        method: "POST",
        body: JSON.stringify({ widgets }),
      });
      await loadWidgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWidgets(false);
    }
  };

  const addWidget = () => {
    setWidgets((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "Untitled Widget",
        widget_type: "table",
        order_index: prev.length,
        config: {},
      },
    ]);
  };

  const updateWidget = (idx: number, patch: Partial<Widget>) => {
    setWidgets((prev) =>
      prev.map((w, i) => (i === idx ? { ...w, ...patch } : w))
    );
  };

  const removeWidget = (idx: number) => {
    setWidgets((prev) => prev.filter((_, i) => i !== idx));
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
      setNewUserRole("viewer");
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
                Viewer / Admin / Developer
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
                      e.target.value as "viewer" | "admin" | "developer"
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="viewer">Viewer</option>
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
                          <td className="px-3 py-2 capitalize text-slate-800 dark:text-slate-100">
                            {u.role}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                            {u.created_at
                              ? new Date(u.created_at).toLocaleString()
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                            {u.role === "viewer" ? (
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
      default:
        return (
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Dashboard Config
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addWidget}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Add Widget
                </button>
                <button
                  type="button"
                  onClick={handleSaveWidgets}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  disabled={savingWidgets}
                >
                  Save
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
                widgets.map((w, idx) => (
                  <div
                    key={w.id || idx}
                    className="rounded-xl border border-slate-200 bg-white/60 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={w.title}
                          onChange={(e) =>
                            updateWidget(idx, { title: e.target.value })
                          }
                          placeholder="Title"
                          className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          value={w.widget_type ?? ""}
                          onChange={(e) =>
                            updateWidget(idx, { widget_type: e.target.value })
                          }
                          placeholder="Type"
                          className="min-w-[120px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          value={w.order_index ?? ""}
                          onChange={(e) =>
                            updateWidget(idx, {
                              order_index: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="Order"
                          className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeWidget(idx)}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                      >
                        Remove
                      </button>
                    </div>
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
                      className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      rows={4}
                    />
                  </div>
                ))}
            </div>
          </section>
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
