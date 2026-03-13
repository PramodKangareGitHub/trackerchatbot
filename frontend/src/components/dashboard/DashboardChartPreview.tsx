import React, { useMemo } from "react";

export type DashboardChartConfig = {
  dataset_id?: string;
  x_field?: string;
  y_field?: string;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_values?: string[];
  x_date_mode?: "raw" | "ageing" | "quarter" | "financial_quarter";
  x_ageing_ranges?: string[];
  x_quarter_values?: string[];
  x_fiscal_year_start_month?: number;
  y_axis_mode?: "count" | "value" | "ageing_days" | "date_diff";
  y_aggregation?: "sum" | "avg" | "min" | "max";
  y_start_date_field?: string;
  y_end_date_field?: string;
};

type DashboardChartPreviewProps = {
  title?: string;
  config: DashboardChartConfig;
  columns: string[];
  rows: Record<string, unknown>[];
};

type ColumnSelection = {
  mode: "ageing" | "quarter" | "financial_quarter";
  values: string[];
  fiscalStartMonth?: number;
};

const toQuarterLabel = (val: unknown, withYear = false) => {
  if (val === null || val === undefined) return "(blank)";
  const str = String(val);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let month: number | null = null;
  let year: number | null = null;
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]) - 1;
  } else {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      month = parsed.getUTCMonth();
      year = parsed.getUTCFullYear();
    }
  }
  if (month === null || year === null || month < 0 || month > 11) return str;
  const q = Math.floor(month / 3) + 1;
  return withYear ? `Q${q} ${year}` : `Q${q}`;
};

const toFiscalQuarterLabel = (val: unknown, fiscalStartMonth = 4): string => {
  if (val === null || val === undefined) return "(blank)";
  const parsed = new Date(String(val));
  if (Number.isNaN(parsed.getTime())) return String(val);
  const month = parsed.getUTCMonth();
  const year = parsed.getUTCFullYear();
  const start = Math.min(11, Math.max(0, fiscalStartMonth - 1));
  const offset = (month - start + 12) % 12;
  const q = Math.floor(offset / 3) + 1;
  const fyStartYear = month >= start ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const startShort = String(fyStartYear).slice(-2).padStart(2, "0");
  const endShort = String(fyEndYear).slice(-2).padStart(2, "0");
  return `FY${startShort}-${endShort}Q${q}`;
};

const ageingBucket = (val: unknown, ranges: string[]) => {
  if (val === null || val === undefined) return "(blank)";
  const str = String(val);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  const diffDays = Math.floor(
    (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  );
  for (const raw of ranges) {
    const label = raw.trim();
    const rangeMatch = label.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const low = Number(rangeMatch[1]);
      const high = Number(rangeMatch[2]);
      if (Number.isFinite(low) && Number.isFinite(high)) {
        if (diffDays >= low && diffDays <= high) return label;
      }
    }
    const plusMatch = label.match(/^(\d+)\+$/);
    if (plusMatch) {
      const low = Number(plusMatch[1]);
      if (Number.isFinite(low) && diffDays >= low) return label;
    }
  }
  if (diffDays <= 30) return "0-30";
  if (diffDays <= 60) return "31-60";
  if (diffDays <= 90) return "61-90";
  return "90+";
};

const ageingBucketFromDays = (days: number | null, ranges: string[]) => {
  if (days === null || !Number.isFinite(days)) return "(blank)";
  for (const raw of ranges) {
    const label = raw.trim();
    const rangeMatch = label.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const low = Number(rangeMatch[1]);
      const high = Number(rangeMatch[2]);
      if (Number.isFinite(low) && Number.isFinite(high)) {
        if (days >= low && days <= high) return label;
      }
    }
    const plusMatch = label.match(/^(\d+)\+$/);
    if (plusMatch) {
      const low = Number(plusMatch[1]);
      if (Number.isFinite(low) && days >= low) return label;
    }
  }
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
};

const ageInDays = (val: unknown): number | null => {
  if (val === null || val === undefined) return null;
  const parsed = new Date(String(val));
  if (Number.isNaN(parsed.getTime())) return null;
  const diffDays = Math.floor(
    (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Number.isFinite(diffDays) ? diffDays : null;
};

const normalizeStr = (v: unknown) =>
  typeof v === "string"
    ? v.trim().toLowerCase()
    : String(v ?? "")
        .trim()
        .toLowerCase();

const normalizeRangeLabel = (v: string) => v.replace(/\s+/g, "");

const valueForRow = (
  row: Record<string, unknown>,
  key: string | undefined | null
) => {
  if (!key) return undefined;
  if (key in row) return row[key];
  const suffix = key.includes(".") ? key.split(".").slice(-1)[0] : key;
  return row[suffix];
};

const addSelection = (
  map: Map<string, ColumnSelection>,
  column: string,
  selection: ColumnSelection
) => {
  if (!column) return;
  map.set(column, selection);
  if (column.includes(".")) {
    const suffix = column.split(".").slice(-1)[0];
    if (suffix) map.set(suffix, selection);
  }
};

const buildSelections = (config: DashboardChartConfig) => {
  const selections = new Map<string, ColumnSelection>();
  if (config.x_field && config.x_date_mode && config.x_date_mode !== "raw") {
    const mode = config.x_date_mode;
    const values =
      mode === "ageing"
        ? (config.x_ageing_ranges || []).map((v) => String(v))
        : (config.x_quarter_values && config.x_quarter_values.length
            ? config.x_quarter_values
            : ["Q1", "Q2", "Q3", "Q4"]
          ).map((v) => String(v));
    addSelection(selections, config.x_field, {
      mode,
      values,
      fiscalStartMonth: config.x_fiscal_year_start_month,
    });
  }
  return selections;
};

const selectionFor = (
  selections: Map<string, ColumnSelection>,
  col: string
): ColumnSelection | undefined =>
  selections.get(col) || selections.get(col.split(".").slice(-1)[0]);

const labelFor = (
  col: string,
  val: unknown,
  selection: ColumnSelection | undefined
) => {
  if (selection?.mode === "ageing")
    return ageingBucket(val, selection.values || []);
  if (selection?.mode === "quarter") {
    const withYear = selection.values.some((v) => /\d{4}/.test(v));
    return toQuarterLabel(val, withYear);
  }
  if (selection?.mode === "financial_quarter") {
    return toFiscalQuarterLabel(val, selection.fiscalStartMonth || 4);
  }
  return val === null || val === undefined ? "(blank)" : String(val);
};

const DashboardChartPreview: React.FC<DashboardChartPreviewProps> = ({
  title,
  config,
  columns,
  rows,
}) => {
  const selections = useMemo(() => buildSelections(config), [config]);
  const groupBy = config.group_by || "";
  const groupValues = config.group_by_values || [];
  const filteredRows = rows.filter((row) => {
    if (!groupBy) return true;
    const key = valueForRow(row, groupBy);
    const label = labelFor(groupBy, key, selectionFor(selections, groupBy));
    return (
      !groupValues.length ||
      groupValues.map(normalizeStr).includes(normalizeStr(label))
    );
  });

  const xKey = config.x_field || columns[0];
  const yKey = config.y_field;
  const yMode: NonNullable<DashboardChartConfig["y_axis_mode"]> =
    config.y_axis_mode || (yKey ? "value" : "count");
  const yAggregation: NonNullable<DashboardChartConfig["y_aggregation"]> =
    config.y_aggregation ||
    (yMode === "ageing_days" || yMode === "date_diff" ? "avg" : "sum");
  const isYDateLike = yMode === "ageing_days" || yMode === "date_diff";
  const dateDiffStart =
    config.y_start_date_field ||
    (yMode === "date_diff" ? config.y_field || "" : "");
  const dateDiffEnd = config.y_end_date_field || "";
  const missingDateDiff =
    yMode === "date_diff" && (!dateDiffStart || !dateDiffEnd);
  const yDiffLabel =
    yMode === "date_diff"
      ? "Day difference (end - start)"
      : yMode === "ageing_days"
        ? "Ageing in days"
        : "";
  if (!xKey) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Pick X (and Y) to see a chart.
      </div>
    );
  }

  if (missingDateDiff) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
        Select both start and end date fields to plot day differences.
      </div>
    );
  }

  const yIsDate = yMode === "ageing_days" && !!yKey;
  const aggregated = new Map<
    string,
    {
      xLabel: string;
      groupLabel: string;
      yLabel: string;
      ySum: number;
      yValueCount: number;
      yMin: number;
      yMax: number;
      count: number;
    }
  >();
  const showCountSeries = yMode === "count";

  filteredRows.forEach((row) => {
    const xSelection = selectionFor(selections, xKey);
    const gRaw = groupBy ? valueForRow(row, groupBy) : undefined;
    const gLabel = groupBy
      ? labelFor(groupBy, gRaw, selectionFor(selections, groupBy))
      : "";
    const yValRaw = yKey ? valueForRow(row, yKey) : undefined;
    const xRaw = valueForRow(row, xKey);
    let yNum: number | null = null;
    if (yMode === "value") {
      const n = Number(yValRaw);
      yNum = Number.isFinite(n) ? n : null;
    } else if (yMode === "ageing_days") {
      yNum = ageInDays(yValRaw);
    } else if (yMode === "date_diff") {
      const startVal = dateDiffStart
        ? valueForRow(row, dateDiffStart)
        : undefined;
      const endVal = dateDiffEnd ? valueForRow(row, dateDiffEnd) : undefined;
      if (startVal && endVal) {
        const start = new Date(String(startVal));
        const end = new Date(String(endVal));
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          yNum = Math.floor(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          );
        }
      }
    }
    if (isYDateLike && yNum === null) {
      // Skip rows with null/invalid date-based metrics when required.
      return;
    }
    const xAgeDays = xSelection?.mode === "ageing" ? ageInDays(xRaw) : null;
    const xValueForLabel =
      isYDateLike && (xRaw === null || xRaw === undefined || xRaw === "")
        ? yNum
        : xRaw;
    const xLabel =
      xSelection?.mode === "ageing" && typeof xValueForLabel === "number"
        ? ageingBucketFromDays(xValueForLabel, xSelection.values || [])
        : xSelection?.mode === "ageing" && typeof xAgeDays === "number"
          ? ageingBucketFromDays(xAgeDays, xSelection.values || [])
          : labelFor(xKey, xValueForLabel, xSelection);
    const yLabel = yKey
      ? isYDateLike && yNum !== null
        ? String(yNum)
        : labelFor(yKey, yValRaw, selectionFor(selections, yKey))
      : "";

    const bucketKey = groupBy ? `${xLabel}|||${gLabel}` : xLabel;
    if (!aggregated.has(bucketKey)) {
      aggregated.set(bucketKey, {
        xLabel,
        groupLabel: gLabel,
        yLabel,
        ySum: 0,
        yValueCount: 0,
        yMin: Number.POSITIVE_INFINITY,
        yMax: Number.NEGATIVE_INFINITY,
        count: 0,
      });
    }
    const entry = aggregated.get(bucketKey)!;
    entry.count += 1;
    if (yMode !== "count" && yNum !== null) {
      entry.ySum += yNum;
      entry.yValueCount += 1;
      entry.yMin = Math.min(entry.yMin, yNum);
      entry.yMax = Math.max(entry.yMax, yNum);
    }
    if (yLabel && !entry.yLabel) entry.yLabel = yLabel;
  });

  const xSelection = selectionFor(selections, xKey);
  if (xSelection && xSelection.mode !== "financial_quarter") {
    const expectedXs =
      xSelection.mode === "ageing"
        ? xSelection.values.filter(Boolean)
        : (xSelection.values && xSelection.values.length
            ? xSelection.values
            : ["Q1", "Q2", "Q3", "Q4"]
          ).filter(Boolean);
    const baseGroups = groupBy
      ? (groupValues.length ? groupValues : [""]).map((v) =>
          labelFor(groupBy, v, selectionFor(selections, groupBy))
        )
      : [""];
    expectedXs.forEach((xLabel) => {
      baseGroups.forEach((gLabel) => {
        const bucketKey = groupBy ? `${xLabel}|||${gLabel}` : xLabel;
        if (!aggregated.has(bucketKey)) {
          aggregated.set(bucketKey, {
            xLabel,
            groupLabel: groupBy ? gLabel : "",
            yLabel: "",
            ySum: 0,
            yValueCount: 0,
            yMin: Number.POSITIVE_INFINITY,
            yMax: Number.NEGATIVE_INFINITY,
            count: 0,
          });
        }
      });
    });
  }

  const points = Array.from(aggregated.values()).map((p) => {
    const yValue =
      yMode === "count"
        ? p.count
        : p.yValueCount > 0
          ? yAggregation === "avg"
            ? p.ySum / p.yValueCount
            : yAggregation === "min"
              ? p.yMin
              : yAggregation === "max"
                ? p.yMax
                : p.ySum
          : 0;
    // Chart labels should be integers for clarity; round to nearest whole number.
    const roundedValue = Number.isFinite(yValue) ? Math.round(yValue) : 0;
    return { ...p, value: roundedValue };
  });

  const xSelectionForSort = selectionFor(selections, xKey);
  if (xSelectionForSort?.mode === "ageing") {
    const xOrder = new Map<string, number>();
    (xSelectionForSort.values || []).forEach((v, idx) => {
      if (!xOrder.has(v)) xOrder.set(v, idx);
    });
    const groupOrder = new Map<string, number>();
    if (groupBy) {
      groupValues.forEach((v, idx) => {
        const label = labelFor(groupBy, v, selectionFor(selections, groupBy));
        if (!groupOrder.has(label)) groupOrder.set(label, idx);
      });
    }
    points.sort((a, b) => {
      const ax = xOrder.has(a.xLabel)
        ? xOrder.get(a.xLabel)!
        : Number.MAX_SAFE_INTEGER;
      const bx = xOrder.has(b.xLabel)
        ? xOrder.get(b.xLabel)!
        : Number.MAX_SAFE_INTEGER;
      if (ax !== bx) return ax - bx;
      if (groupBy) {
        const ag = groupOrder.has(a.groupLabel)
          ? groupOrder.get(a.groupLabel)!
          : Number.MAX_SAFE_INTEGER;
        const bg = groupOrder.has(b.groupLabel)
          ? groupOrder.get(b.groupLabel)!
          : Number.MAX_SAFE_INTEGER;
        if (ag !== bg) return ag - bg;
      }
      return 0;
    });
  }
  if (!points.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No data to chart.
      </div>
    );
  }

  const valueMax = Math.max(1, ...points.map((p) => p.value));
  const barHeight = 180;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div
        className="flex items-end gap-3 overflow-x-auto"
        style={{ minHeight: "220px" }}
      >
        {points.map((p, idx) => {
          const h = Math.max(8, (p.value / valueMax) * barHeight);
          const barWidth = Math.max(28, Math.min(96, 520 / points.length));
          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300"
            >
              <div
                className="flex flex-col items-center gap-1"
                style={{ width: `${barWidth}px` }}
              >
                <div
                  className="text-xs font-semibold text-slate-800 dark:text-slate-100"
                  title={yDiffLabel || undefined}
                >
                  {p.value}
                </div>
                <div
                  className="w-full rounded-t-md bg-indigo-500"
                  style={{ height: `${h}px` }}
                />
              </div>
              <div className="w-32 text-center text-[11px]">
                <div className="font-semibold text-slate-700 dark:text-slate-100">
                  {p.xLabel}
                </div>
                {groupBy && p.groupLabel && p.groupLabel !== p.xLabel && (
                  <div className="text-slate-500 dark:text-slate-400">
                    {p.groupLabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {yDiffLabel && (
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          {yDiffLabel}; rows with missing dates are skipped.
        </p>
      )}
    </div>
  );
};

export default DashboardChartPreview;
