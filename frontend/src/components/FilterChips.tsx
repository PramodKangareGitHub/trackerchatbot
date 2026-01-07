import { useEffect, useMemo, useState } from "react";

type FilterOption = {
  column: string;
  values: string[];
  reason?: string;
  bucket?: string;
};

type AppliedFilters = Record<string, Set<string>>;

type Props = {
  groups: FilterOption[];
  applied: AppliedFilters;
  onChange: (filters: AppliedFilters) => void;
};

const FilterChips = ({ groups, applied, onChange }: Props) => {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set()
  );
  const [numericColumns, setNumericColumns] = useState<Set<string>>(new Set());
  const [rangeState, setRangeState] = useState<
    Record<string, { min: number; max: number }>
  >({});
  const [rangeBounds, setRangeBounds] = useState<
    Record<string, { min: number; max: number }>
  >({});
  const [rangeDraft, setRangeDraft] = useState<
    Record<string, { min: string; max: string }>
  >({});
  const [dateColumns, setDateColumns] = useState<Set<string>>(new Set());
  const [dateBounds, setDateBounds] = useState<
    Record<string, { start: string; end: string }>
  >({});
  const [dateDraft, setDateDraft] = useState<
    Record<string, { start: string; end: string }>
  >({});

  // Ensure numeric range state is initialized when bounds arrive (e.g., after async fetch)
  useEffect(() => {
    if (!Object.keys(rangeBounds).length) return;
    setRangeState((prev) => {
      const patch: Record<string, { min: number; max: number }> = {};
      Object.entries(rangeBounds).forEach(([col, bounds]) => {
        if (!prev[col]) {
          patch[col] = bounds;
        }
      });
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
    setRangeDraft((prev) => {
      const patch: Record<string, { min: string; max: string }> = {};
      Object.entries(rangeBounds).forEach(([col, bounds]) => {
        if (!prev[col]) {
          patch[col] = { min: String(bounds.min), max: String(bounds.max) };
        }
      });
      return Object.keys(patch).length ? { ...prev, ...patch } : prev;
    });
  }, [rangeBounds]);

  const canon = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  useEffect(() => {
    if (!groups.length) {
      setSelectedColumns(new Set());
      setNumericColumns(new Set());
      setRangeState({});
      setRangeBounds({});
      setRangeDraft({});
      setDateColumns(new Set());
      setDateBounds({});
      setDateDraft({});
      return;
    }
    // Default to the first four columns in the dataset order; ignore recommendations
    const firstFour = groups.slice(0, 4).map((g) => g.column);
    setSelectedColumns(new Set(firstFour));

    // Detect numeric columns and precompute min/max for range sliders
    const numericSet = new Set<string>();
    const nextRange: Record<string, { min: number; max: number }> = {};
    const nextBounds: Record<string, { min: number; max: number }> = {};
    const dateSet = new Set<string>();
    const nextDateBounds: Record<string, { start: string; end: string }> = {};

    const parseDateToken = (value: string) => {
      const trimmed = String(value).trim();
      // Accept YYYY-MM or YYYY-MM-DD with optional time part
      let match = trimmed.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[ T].*)?$/);
      if (match) {
        const year = match[1];
        const month = match[2];
        const day = match[3] || "01";
        const iso = `${year}-${month}-${day}`;
        const time = Date.parse(`${iso}T00:00:00Z`);
        if (!Number.isFinite(time)) return null;
        return { iso, time };
      }
      // Accept MM/DD/YYYY with optional time part
      match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/);
      if (match) {
        const month = match[1].padStart(2, "0");
        const day = match[2].padStart(2, "0");
        const year = match[3];
        const iso = `${year}-${month}-${day}`;
        const time = Date.parse(`${iso}T00:00:00Z`);
        if (!Number.isFinite(time)) return null;
        return { iso, time };
      }
      // Fallback: Date.parse if it yields a valid date
      const parsed = Date.parse(trimmed);
      if (Number.isFinite(parsed)) {
        const iso = new Date(parsed).toISOString().slice(0, 10);
        return { iso, time: parsed };
      }
      return null;
    };

    // Detect date columns first (bucket=month or enough parseable dates)
    groups.forEach((g) => {
      const sanitizedValues = (g.values || [])
        .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
        .filter(Boolean);
      const allNumeric =
        sanitizedValues.length > 0 &&
        sanitizedValues.every((v) => {
          const n = Number(v);
          return Number.isFinite(n) && /^[+-]?(\d+)(\.\d+)?$/.test(v);
        });
      // Prefer numeric treatment for explicitly numeric columns (e.g., ageing_as_on_today)
      const numericPreferred = new Set([
        "ageing_as_on_today",
        "ageing",
        "aging",
      ]);
      if (allNumeric || numericPreferred.has(canon(g.column))) {
        return;
      }
      const tokens = sanitizedValues
        .map((v) => parseDateToken(v))
        .filter(Boolean) as { iso: string; time: number }[];
      const fromBucket = (g.bucket || "").toLowerCase() === "month";
      const allParseableDates =
        tokens.length > 0 && tokens.length === sanitizedValues.length;
      const enoughSamples =
        tokens.length >= Math.min(3, sanitizedValues.length || 0);
      // Only treat as date if backend marked it (bucket=month) or every value is a parseable date with enough samples
      if (!(fromBucket || (allParseableDates && enoughSamples))) return;
      dateSet.add(g.column);
      if (tokens.length) {
        const minToken = tokens.reduce(
          (min, t) => (t.time < min.time ? t : min),
          tokens[0]
        );
        const maxToken = tokens.reduce(
          (max, t) => (t.time > max.time ? t : max),
          tokens[0]
        );
        nextDateBounds[g.column] = { start: minToken.iso, end: maxToken.iso };
      } else if (sanitizedValues.length) {
        // Fallback to first/last of provided values
        const first = sanitizedValues[0];
        const last = sanitizedValues[sanitizedValues.length - 1];
        const firstParsed = parseDateToken(first);
        const lastParsed = parseDateToken(last);
        nextDateBounds[g.column] = {
          start: firstParsed?.iso || String(first),
          end: lastParsed?.iso || String(last),
        };
      } else {
        nextDateBounds[g.column] = { start: "", end: "" };
      }
    });

    // Detect numeric columns (skip anything identified as date)
    groups.forEach((g) => {
      if (dateSet.has(g.column)) return;
      const nums = (g.values || [])
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
      if (!nums.length || nums.length !== (g.values?.length || 0)) return;
      numericSet.add(g.column);
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      nextRange[g.column] = { min, max };
      nextBounds[g.column] = { min, max };
    });
    setNumericColumns(numericSet);
    setRangeState(nextRange);
    setRangeBounds(nextBounds);
    setRangeDraft(
      Object.fromEntries(
        Object.entries(nextRange).map(([col, rng]) => [
          col,
          { min: String(rng.min), max: String(rng.max) },
        ])
      )
    );

    setDateColumns(dateSet);
    setDateBounds(nextDateBounds);
    setDateDraft(
      Object.fromEntries(
        Object.entries(nextDateBounds).map(([col, rng]) => [
          col,
          { start: rng.start, end: rng.end },
        ])
      )
    );
  }, [groups]);

  const visibleGroups = useMemo(() => {
    if (!selectedColumns.size) return groups;
    return groups.filter((g) => selectedColumns.has(g.column));
  }, [groups, selectedColumns]);

  const toggle = (col: string, value: string) => {
    const current = applied[col] ? new Set(applied[col]) : new Set<string>();
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    const next: AppliedFilters = { ...applied, [col]: current };
    // Clean empty sets
    Object.keys(next).forEach((k) => {
      if (!next[k].size) delete next[k];
    });
    onChange(next);
  };

  if (!groups.length) return null;

  const clampRange = (
    col: string,
    minVal: number | undefined,
    maxVal: number | undefined
  ) => {
    const bounds = rangeBounds[col];
    if (!bounds) return null;
    const min = Number.isFinite(minVal)
      ? Math.max(bounds.min, Number(minVal))
      : bounds.min;
    const max = Number.isFinite(maxVal)
      ? Math.min(bounds.max, Number(maxVal))
      : bounds.max;
    if (min > max) {
      return { min, max: min };
    }
    return { min, max };
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Filter Columns
        </label>
        <select
          multiple
          size={Math.min(8, Math.max(4, groups.length))}
          value={[...selectedColumns]}
          onChange={(e) => {
            const next = new Set<string>();
            Array.from(e.target.selectedOptions).forEach((opt) =>
              next.add(opt.value)
            );
            setSelectedColumns(next);
          }}
          className="max-h-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {groups.map((g) => (
            <option key={g.column} value={g.column}>
              {g.column}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Select one or more columns to view and apply their values.
        </p>
      </div>

      {!visibleGroups.length && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Select one or more columns to see their values.
        </p>
      )}

      {visibleGroups.map((group) => (
        <div
          key={group.column}
          className="rounded-xl border border-slate-200 bg-white/60 p-3 shadow-sm dark:border-slate-700/70 dark:bg-slate-800/60"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {group.column}
              </p>
              {group.reason && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {group.reason}
                </p>
              )}
            </div>
            <span className="text-[11px] uppercase tracking-wide text-slate-400">
              {numericColumns.has(group.column)
                ? "Range"
                : dateColumns.has(group.column)
                ? "Date Range"
                : "Multi-select"}
            </span>
          </div>
          {numericColumns.has(group.column) ? (
            (() => {
              const bounds = rangeBounds[group.column] || { min: 0, max: 0 };
              const current = rangeState[group.column] || bounds;
              const draft = rangeDraft[group.column] || {
                min: String(current.min),
                max: String(current.max),
              };
              return (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Range filter</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {applied[group.column]?.size
                        ? Array.from(applied[group.column])[0].replace(
                            "range:",
                            ""
                          )
                        : `${current.min ?? ""} - ${current.max ?? ""}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <label className="w-10 text-right">Min</label>
                      <input
                        type="number"
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.min}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              ...(d[group.column] || draft),
                              min: val,
                            },
                          }));
                        }}
                        onBlur={() => {
                          const draftMin = rangeDraft[group.column]?.min;
                          const prev = rangeState[group.column] || bounds;
                          const bounded = clampRange(
                            group.column,
                            draftMin === undefined || draftMin === ""
                              ? prev.min
                              : Number(draftMin),
                            prev?.max
                          );
                          if (!bounded) return;
                          setRangeState((r) => ({
                            ...r,
                            [group.column]: bounded,
                          }));
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              min: String(bounded.min),
                              max: String(bounded.max),
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <label className="w-10 text-right">Max</label>
                      <input
                        type="number"
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.max}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              ...(d[group.column] || draft),
                              max: val,
                            },
                          }));
                        }}
                        onBlur={() => {
                          const draftMax = rangeDraft[group.column]?.max;
                          const prev = rangeState[group.column] || bounds;
                          const bounded = clampRange(
                            group.column,
                            prev?.min,
                            draftMax === undefined || draftMax === ""
                              ? prev.max
                              : Number(draftMax)
                          );
                          if (!bounded) return;
                          setRangeState((r) => ({
                            ...r,
                            [group.column]: bounded,
                          }));
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              min: String(bounded.min),
                              max: String(bounded.max),
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={bounds.min}
                        max={bounds.max}
                        value={current.min ?? bounds.min}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const prev = rangeState[group.column] || bounds;
                          const bounded = clampRange(
                            group.column,
                            val,
                            prev?.max
                          );
                          if (!bounded) return;
                          setRangeState((r) => ({
                            ...r,
                            [group.column]: bounded,
                          }));
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              min: String(bounded.min),
                              max: String(bounded.max),
                            },
                          }));
                        }}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-500"
                      />
                      <input
                        type="range"
                        min={bounds.min}
                        max={bounds.max}
                        value={current.max ?? bounds.max}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const prev = rangeState[group.column] || bounds;
                          const bounded = clampRange(
                            group.column,
                            prev?.min,
                            val
                          );
                          if (!bounded) return;
                          setRangeState((r) => ({
                            ...r,
                            [group.column]: bounded,
                          }));
                          setRangeDraft((d) => ({
                            ...d,
                            [group.column]: {
                              min: String(bounded.min),
                              max: String(bounded.max),
                            },
                          }));
                        }}
                        className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-500"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="rounded-md bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        onClick={() => {
                          const current = rangeState[group.column] || bounds;
                          if (!current) return;
                          if (
                            !Number.isFinite(current.min) ||
                            !Number.isFinite(current.max)
                          )
                            return;
                          const next = {
                            ...applied,
                            [group.column]: new Set([
                              `range:${current.min}-${current.max}`,
                            ]),
                          } as AppliedFilters;
                          onChange(next);
                        }}
                      >
                        Apply range
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : dateColumns.has(group.column) ? (
            (() => {
              const bounds = dateBounds[group.column] || {
                start: "",
                end: "",
              };
              const draft = dateDraft[group.column] || bounds;

              const clampDates = (start: string, end: string) => {
                const toMillis = (d: string) =>
                  d ? Date.parse(`${d}T00:00:00Z`) : Number.NaN;
                const startMs = toMillis(start);
                const endMs = toMillis(end);
                const minMs = toMillis(bounds.start);
                const maxMs = toMillis(bounds.end);

                const effStartMs = Number.isFinite(startMs)
                  ? Math.max(startMs, Number.isFinite(minMs) ? minMs : startMs)
                  : minMs;
                const effEndMs = Number.isFinite(endMs)
                  ? Math.min(endMs, Number.isFinite(maxMs) ? maxMs : endMs)
                  : Number.isFinite(maxMs)
                  ? maxMs
                  : effStartMs;

                let startIso =
                  Number.isFinite(effStartMs) && effStartMs > 0
                    ? new Date(effStartMs).toISOString().slice(0, 10)
                    : bounds.start;
                let endIso =
                  Number.isFinite(effEndMs) && effEndMs > 0
                    ? new Date(effEndMs).toISOString().slice(0, 10)
                    : bounds.end || startIso;

                if (startIso && endIso && startIso > endIso) {
                  endIso = startIso;
                }
                return { start: startIso, end: endIso };
              };

              const appliedLabel = applied[group.column]?.size
                ? Array.from(applied[group.column])[0]
                    .replace(/^date:/, "")
                    .replace("..", " to ")
                : `${bounds.start || ""} - ${bounds.end || ""}`;

              return (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>Date range</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {appliedLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                      <label className="w-12 text-right">Start</label>
                      <input
                        type="date"
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.start || ""}
                        min={bounds.start || undefined}
                        max={draft.end || bounds.end || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateDraft((prev) => ({
                            ...prev,
                            [group.column]: {
                              ...(prev[group.column] || draft),
                              start: val,
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-12 text-right">End</label>
                      <input
                        type="date"
                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        value={draft.end || ""}
                        min={draft.start || bounds.start || undefined}
                        max={bounds.end || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateDraft((prev) => ({
                            ...prev,
                            [group.column]: {
                              ...(prev[group.column] || draft),
                              end: val,
                            },
                          }));
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="rounded-md bg-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        onClick={() => {
                          const draftValues = dateDraft[group.column] || draft;
                          const { start, end } = clampDates(
                            draftValues.start || "",
                            draftValues.end || ""
                          );
                          if (!start && !end) return;
                          const nextVal = `date:${start || ""}..${end || ""}`;
                          const next: AppliedFilters = {
                            ...applied,
                            [group.column]: new Set([nextVal]),
                          };
                          onChange(next);
                        }}
                      >
                        Apply range
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {group.values.map((value) => {
                const isActive = applied[group.column]?.has(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(group.column, value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400 dark:text-sky-200"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export type { AppliedFilters, FilterOption };
export default FilterChips;
