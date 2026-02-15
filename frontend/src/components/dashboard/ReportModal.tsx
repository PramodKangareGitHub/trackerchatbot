import React, { useCallback, useEffect, useMemo, useState } from "react";

export type ReportModalProps = {
  open: boolean;
  onClose: () => void;
  columns: string[];
  rows: Record<string, unknown>[];
};

type ColumnType = "date" | "number" | "boolean" | "string";

type Filters = {
  [key: string]:
    | { type: "date"; from: string; to: string }
    | { type: "number"; min: string; max: string; selected: string[] }
    | { type: "boolean"; yes: boolean; no: boolean }
    | { type: "string"; query: string; selected: string[] };
};

const detectColumnType = (values: unknown[]): ColumnType => {
  const sample = values.find((v) => v !== null && v !== undefined);
  if (sample === undefined) return "string";

  const strVal = String(sample).trim();
  const numVal = typeof sample === "number" ? sample : Number(strVal);
  if (!Number.isNaN(numVal) && strVal !== "") return "number";

  const lower = strVal.toLowerCase();
  if (
    lower === "true" ||
    lower === "false" ||
    lower === "yes" ||
    lower === "no"
  ) {
    return "boolean";
  }

  const date = new Date(strVal);
  if (!Number.isNaN(date.getTime()) && /\d{4}-\d{2}-\d{2}/.test(strVal)) {
    return "date";
  }

  return "string";
};

const applyFilters = (rows: Record<string, unknown>[], filters: Filters) => {
  return rows.filter((row) => {
    return Object.entries(filters).every(([col, filter]) => {
      const value = row[col];
      if (filter.type === "date") {
        const dateVal = value ? new Date(String(value)) : null;
        const from = filter.from ? new Date(filter.from) : null;
        const to = filter.to ? new Date(filter.to) : null;
        if (dateVal && Number.isNaN(dateVal.getTime())) return false;
        if (from && dateVal && dateVal < from) return false;
        if (to && dateVal && dateVal > to) return false;
        return true;
      }
      if (filter.type === "number") {
        const num = typeof value === "number" ? value : Number(String(value));
        if (filter.selected.length > 0) {
          const asStr = String(value ?? "");
          return filter.selected.includes(asStr);
        }
        if (
          filter.min !== "" &&
          !Number.isNaN(Number(filter.min)) &&
          num < Number(filter.min)
        ) {
          return false;
        }
        if (
          filter.max !== "" &&
          !Number.isNaN(Number(filter.max)) &&
          num > Number(filter.max)
        ) {
          return false;
        }
        return true;
      }
      if (filter.type === "boolean") {
        const valStr = String(value).toLowerCase();
        const isYes = valStr === "true" || valStr === "yes";
        const isNo = valStr === "false" || valStr === "no";
        if (!filter.yes && isYes) return false;
        if (!filter.no && isNo) return false;
        return filter.yes || filter.no ? isYes || isNo : true;
      }
      if (filter.type === "string") {
        if (filter.selected.length > 0) {
          const asStr = String(value ?? "");
          return filter.selected.includes(asStr);
        }
        if (!filter.query) return true;
        return String(value ?? "")
          .toLowerCase()
          .includes(filter.query.toLowerCase());
      }
      return true;
    });
  });
};

const ReportModal: React.FC<ReportModalProps> = ({
  open,
  onClose,
  columns,
  rows,
}) => {
  const columnTypes = useMemo(() => {
    const types: Record<string, ColumnType> = {};
    columns.forEach((col) => {
      const vals = rows.map((r) => r[col]);
      types[col] = detectColumnType(vals);
    });
    return types;
  }, [columns, rows]);

  const [filters, setFilters] = useState<Filters>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showFilterPicker, setShowFilterPicker] = useState(false);
  const [pendingFilterCol, setPendingFilterCol] = useState<string>("");

  const defaultFilterFor = useCallback(
    (col: string): Filters[string] => {
      const type = columnTypes[col];
      if (type === "date") return { type, from: "", to: "" };
      if (type === "number") return { type, min: "", max: "", selected: [] };
      if (type === "boolean") return { type, yes: true, no: true };
      return { type: "string", query: "", selected: [] };
    },
    [columnTypes]
  );

  useEffect(() => {
    const next: Filters = {};
    if (
      columns.includes("jp_posting_date_to_hcl") &&
      columnTypes["jp_posting_date_to_hcl"] === "date"
    ) {
      next["jp_posting_date_to_hcl"] = defaultFilterFor(
        "jp_posting_date_to_hcl"
      );
    }
    setFilters(next);
    setVisibleColumns(columns);
  }, [columns, columnTypes, defaultFilterFor]);

  const filteredRows = useMemo(
    () => applyFilters(rows, filters),
    [rows, filters]
  );

  const handleExport = useCallback(() => {
    const header = visibleColumns.join(",");
    const body = filteredRows
      .map((row) =>
        visibleColumns
          .map((col) => {
            const val = row[col];
            const safe =
              val === null || val === undefined
                ? ""
                : String(val).replace(/"/g, '""');
            return `"${safe}"`;
          })
          .join(",")
      )
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, visibleColumns]);

  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const availableFilterColumns = useMemo(
    () => columns.filter((c) => !filters[c]),
    [columns, filters]
  );

  const uniqueValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    const maxValues = 50;
    columns.forEach((col) => {
      const set = new Set<string>();
      for (const row of rows) {
        const val = row[col];
        if (val === null || val === undefined) continue;
        set.add(String(val));
        if (set.size >= maxValues) break;
      }
      out[col] = Array.from(set).sort();
    });
    return out;
  }, [columns, rows]);

  useEffect(() => {
    if (!pendingFilterCol && availableFilterColumns.length) {
      setPendingFilterCol(availableFilterColumns[0]);
    }
    if (!availableFilterColumns.length) {
      setShowFilterPicker(false);
    }
  }, [availableFilterColumns, pendingFilterCol]);

  const addFilter = () => {
    if (!pendingFilterCol) return;
    setFilters((prev) => ({
      ...prev,
      [pendingFilterCol]: defaultFilterFor(pendingFilterCol),
    }));
    setPendingFilterCol("");
    setShowFilterPicker(false);
  };

  const removeFilter = (col: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[col];
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6">
      <div className="flex w-[80%] max-w-6xl max-h-[90vh] flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Generate Report
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {/* Row 1: Filters (sticky) */}
          <div className="sticky top-0 z-20 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Filters
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowFilterPicker((v) => !v)}
                  disabled={!availableFilterColumns.length}
                  className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  Add Filter
                </button>
                {Object.keys(filters).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="rounded-md border border-transparent px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {showFilterPicker && availableFilterColumns.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <select
                  value={pendingFilterCol || availableFilterColumns[0] || ""}
                  onChange={(e) => setPendingFilterCol(e.target.value)}
                  className="min-w-[180px] rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {availableFilterColumns.map((col) => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addFilter}
                  className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                >
                  Apply
                </button>
              </div>
            )}

            <div className="grid gap-3 text-xs text-slate-700 dark:text-slate-200 md:grid-cols-2">
              {Object.keys(filters).length === 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  No filters applied. Use Add Filter to start.
                </p>
              )}
              {Object.entries(filters).map(([col, filter]) => {
                const type = columnTypes[col];

                if (type === "date" && filter.type === "date") {
                  return (
                    <div key={col} className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {col}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={filter.from}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [col]: { ...filter, from: e.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <span className="text-[11px] text-slate-500">to</span>
                        <input
                          type="date"
                          value={filter.to}
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [col]: { ...filter, to: e.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  );
                }

                if (type === "number" && filter.type === "number") {
                  return (
                    <div key={col} className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {col}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={filter.min}
                          placeholder="Min"
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [col]: { ...filter, min: e.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                        <input
                          type="number"
                          value={filter.max}
                          placeholder="Max"
                          onChange={(e) =>
                            setFilters((prev) => ({
                              ...prev,
                              [col]: { ...filter, max: e.target.value },
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      {uniqueValues[col]?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {uniqueValues[col].map((val) => {
                            const checked = filter.selected.includes(val);
                            return (
                              <label
                                key={val}
                                className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:text-slate-200"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      [col]: {
                                        ...filter,
                                        selected: e.target.checked
                                          ? [...filter.selected, val]
                                          : filter.selected.filter(
                                              (v) => v !== val
                                            ),
                                      },
                                    }))
                                  }
                                />
                                {val}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                if (type === "boolean" && filter.type === "boolean") {
                  return (
                    <div key={col} className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {col}
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={filter.yes}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [col]: { ...filter, yes: e.target.checked },
                              }))
                            }
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={filter.no}
                            onChange={(e) =>
                              setFilters((prev) => ({
                                ...prev,
                                [col]: { ...filter, no: e.target.checked },
                              }))
                            }
                          />
                          No
                        </label>
                        <button
                          type="button"
                          onClick={() => removeFilter(col)}
                          className="ml-auto rounded-md border border-transparent px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          aria-label={`Remove filter ${col}`}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                }

                if (filter.type === "string") {
                  return (
                    <div key={col} className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                        {col}
                      </div>
                      <input
                        type="text"
                        value={filter.query}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            [col]: { ...filter, query: e.target.value },
                          }))
                        }
                        placeholder="Contains"
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                      {uniqueValues[col]?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {uniqueValues[col].map((val) => {
                            const checked = filter.selected.includes(val);
                            return (
                              <label
                                key={val}
                                className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 dark:border-slate-700 dark:text-slate-200"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      [col]: {
                                        ...filter,
                                        selected: e.target.checked
                                          ? [...filter.selected, val]
                                          : filter.selected.filter(
                                              (v) => v !== val
                                            ),
                                      },
                                    }))
                                  }
                                />
                                {val}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeFilter(col)}
                          className="rounded-md border border-transparent px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          aria-label={`Remove filter ${col}`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          {/* Row 2: Actions (sticky) */}
          <div className="sticky top-[calc(1rem+0px)] z-10 space-y-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowColumnPicker((v) => !v)}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                Add Columns
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
              >
                Export
              </button>
            </div>

            {showColumnPicker && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800/60">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                  Choose columns
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleColumns(columns)}
                    className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleColumns([])}
                    className="rounded-md border border-slate-300 px-3 py-1 font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {columns.map((col) => (
                    <label
                      key={col}
                      className="flex items-center gap-1 text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col)}
                        onChange={() => toggleColumn(col)}
                      />
                      {col}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row 3: Data grid */}
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 shadow-inner dark:border-slate-700">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100">
                <tr>
                  {visibleColumns.map((c) => (
                    <th
                      key={c}
                      className="whitespace-nowrap px-3 py-2 font-semibold"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 0
                        ? "bg-white dark:bg-slate-900"
                        : "bg-slate-50 dark:bg-slate-800"
                    }
                  >
                    {visibleColumns.map((c) => (
                      <td
                        key={c}
                        className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-slate-200"
                      >
                        {row[c] === null || row[c] === undefined
                          ? ""
                          : String(row[c])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td
                      colSpan={visibleColumns.length || 1}
                      className="px-3 py-4 text-center text-slate-500 dark:text-slate-400"
                    >
                      No rows match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportModal;
