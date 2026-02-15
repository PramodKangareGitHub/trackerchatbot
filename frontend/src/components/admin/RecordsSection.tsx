import type { Dispatch, SetStateAction } from "react";
import type { Dataset } from "./types";

export type RecordsSectionProps = {
  selectedDataset?: Dataset;
  recordDraft: Record<string, string>;
  setRecordDraft: Dispatch<SetStateAction<Record<string, string>>>;
  onAddRecord: () => void;
  records: Record<string, unknown>[];
  recordsLoading: boolean;
  editRowId: number | null;
  setEditRowId: Dispatch<SetStateAction<number | null>>;
  editDraft: Record<string, unknown>;
  setEditDraft: Dispatch<SetStateAction<Record<string, unknown>>>;
  onUpdateRecord: () => void;
  onDeleteRecord: (rowid: number) => void;
  recordsPage: number;
  recordsTotal: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onRefresh: () => void;
  actionLoading: boolean;
};

const RecordsSection = ({
  selectedDataset,
  recordDraft,
  setRecordDraft,
  onAddRecord,
  records,
  recordsLoading,
  editRowId,
  setEditRowId,
  editDraft,
  setEditDraft,
  onUpdateRecord,
  onDeleteRecord,
  recordsPage,
  recordsTotal,
  pageSize,
  onPageChange,
  onExport,
  onRefresh,
  actionLoading,
}: RecordsSectionProps) => {
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
            onClick={onRefresh}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            disabled={recordsLoading || !selectedDataset}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onExport}
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
              onClick={onAddRecord}
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
                                    (editDraft[col] ?? row[col] ?? "") as string
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
                                  onClick={onUpdateRecord}
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
                                  onClick={() => onDeleteRecord(rid)}
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
                onClick={() => onPageChange(Math.max(0, recordsPage - 1))}
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
                onClick={() => onPageChange(recordsPage + 1)}
                disabled={
                  (recordsPage + 1) * pageSize >= recordsTotal || recordsLoading
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
};

export default RecordsSection;
