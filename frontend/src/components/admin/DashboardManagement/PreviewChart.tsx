import { useMemo } from "react";
import type { ChartConfig } from "../types";

export type PreviewChartProps = {
  widgetTitle?: string;
  chartConfig: ChartConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
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
type ColumnSelection = {
  mode: "ageing" | "quarter" | "financial_quarter";
  values: string[];
  fiscalStartMonth?: number;
};

const quarterMatch = (v: string) => {
  const m = v.match(/^Q([1-4])(?:\s+FY?(\d{4}))?$/i);
  if (!m) return null;
  const q = Number(m[1]);
  const year = m[2] ? Number(m[2]) : null;
  return { q, year };
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

const isRangeLabel = (v: string) =>
  /^(\d+)\s*-\s*(\d+)$/.test(v) || /^\d+\+$/.test(v);

const ageingBucket = (val: unknown, ranges: string[]) => {
  if (val === null || val === undefined) return "(blank)";
  const str = String(val);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  const diffDays = Math.floor(
    (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (!Number.isFinite(diffDays)) return str;

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

const buildSelections = (chartConfig: ChartConfig) => {
  const selections = new Map<string, ColumnSelection>();

  (chartConfig.filters || []).forEach((f) => {
    const op = (f.op || (f as any).operator || "").toLowerCase();
    if (op !== "ageing_range" && op !== "quarter") return;
    const values = Array.isArray(f.value)
      ? f.value.map((v) => String(v))
      : f.value
        ? [String(f.value)]
        : [];
    const mode: ColumnSelection["mode"] =
      op === "quarter" ? "quarter" : "ageing";
    const col = f.field || "";
    const prefixed =
      f.table && col && !col.includes(".") ? `${f.table}.${col}` : col;
    addSelection(selections, prefixed, { mode, values });
  });

  if (
    chartConfig.x_field &&
    chartConfig.x_date_mode &&
    chartConfig.x_date_mode !== "raw"
  ) {
    const mode = chartConfig.x_date_mode;
    const values =
      mode === "ageing"
        ? (chartConfig.x_ageing_ranges || []).map((v) => String(v))
        : (chartConfig.x_quarter_values && chartConfig.x_quarter_values.length
            ? chartConfig.x_quarter_values
            : ["Q1", "Q2", "Q3", "Q4"]
          ).map((v) => String(v));
    addSelection(selections, chartConfig.x_field, {
      mode,
      values,
      fiscalStartMonth: chartConfig.x_fiscal_year_start_month,
    });
  }

  return selections;
};

const selectionFor = (
  selections: Map<string, ColumnSelection>,
  col: string
): ColumnSelection | undefined => {
  return selections.get(col) || selections.get(col.split(".").slice(-1)[0]);
};

const labelFor = (
  col: string,
  val: unknown,
  selection: ColumnSelection | undefined
) => {
  if (selection?.mode === "ageing") {
    return ageingBucket(val, selection.values || []);
  }
  if (selection?.mode === "quarter") {
    const withYear = selection.values.some((v) =>
      Boolean(quarterMatch(v)?.year)
    );
    return toQuarterLabel(val, withYear);
  }
  if (selection?.mode === "financial_quarter") {
    return toFiscalQuarterLabel(val, selection.fiscalStartMonth || 4);
  }
  return val === null || val === undefined ? "(blank)" : String(val);
};

const matchesSelection = (
  col: string,
  values: string[],
  rowVal: unknown,
  selections: Map<string, ColumnSelection>
) => {
  if (!values.length) return true;
  const selection = selectionFor(selections, col);
  const label = labelFor(col, rowVal, selection);
  if (selection?.mode === "ageing" && typeof label === "string") {
    const normVals = values.map((v) => normalizeRangeLabel(normalizeStr(v)));
    return normVals.includes(normalizeRangeLabel(normalizeStr(label)));
  }
  const normVals = values.map(normalizeStr);
  return normVals.includes(normalizeStr(label));
};

const ensureBuckets = (
  aggregated: Map<
    string,
    {
      label: string;
      xLabel: string;
      groupLabel: string;
      yStrings: Set<string>;
      ySum: number;
      yValueCount: number;
      yHasValue: boolean;
      yMin: number;
      yMax: number;
      count: number;
    }
  >,
  xKey: string,
  groupBy: string,
  selections: Map<string, ColumnSelection>,
  groupValues: string[]
) => {
  const xSelection = selectionFor(selections, xKey);
  if (!xSelection || xSelection.mode === "financial_quarter") return;
  const expectedXs =
    xSelection.mode === "ageing"
      ? (xSelection.values || []).filter(Boolean)
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
          label: groupBy ? `${xLabel} | ${gLabel}` : xLabel,
          xLabel,
          groupLabel: groupBy ? gLabel : "",
          yStrings: new Set<string>(),
          ySum: 0,
          yValueCount: 0,
          yHasValue: false,
          yMin: Number.POSITIVE_INFINITY,
          yMax: Number.NEGATIVE_INFINITY,
          count: 0,
        });
      }
    });
  });
};

const PreviewChart = ({
  widgetTitle,
  chartConfig,
  data,
}: PreviewChartProps) => {
  const selections = useMemo(() => buildSelections(chartConfig), [chartConfig]);

  const groupBy = chartConfig.group_by || "";
  const groupValues = chartConfig.group_by_values || [];
  const filterBy = chartConfig.filter_by || "";
  const filterValues = chartConfig.filter_values || [];

  const rowsAfterFilter = filterBy
    ? data.rows.filter((row) =>
        matchesSelection(
          filterBy,
          filterValues,
          valueForRow(row, filterBy),
          selections
        )
      )
    : data.rows;

  const rowsFiltered = rowsAfterFilter.filter((row) => {
    if (!groupBy) return true;
    const key = valueForRow(row, groupBy);
    return matchesSelection(groupBy, groupValues, key, selections);
  });

  const xKey = chartConfig.x_field || data.columns[0];
  const yKey =
    chartConfig.y_field ||
    data.columns.find((c) =>
      data.rows.every((r) => Number.isFinite(Number(r[c])))
    );

  const yMode: NonNullable<ChartConfig["y_axis_mode"]> =
    chartConfig.y_axis_mode || (yKey ? "value" : "count");
  const yAggregation: NonNullable<ChartConfig["y_aggregation"]> =
    chartConfig.y_aggregation ||
    (yMode === "ageing_days" || yMode === "date_diff" ? "avg" : "sum");
  const dateDiffStart = chartConfig.y_start_date_field;
  const dateDiffEnd = chartConfig.y_end_date_field;
  const isYDateLike = yMode === "ageing_days" || yMode === "date_diff";
  const yDiffLabel =
    yMode === "date_diff"
      ? "Day difference (end - start)"
      : yMode === "ageing_days"
        ? "Ageing in days"
        : "";

  if (!xKey) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Pick X (and Y) to preview a chart.
      </div>
    );
  }
  const aggregated = new Map<
    string,
    {
      label: string;
      xLabel: string;
      groupLabel: string;
      yStrings: Set<string>;
      ySum: number;
      yValueCount: number;
      yHasValue: boolean;
      yMin: number;
      yMax: number;
      count: number;
    }
  >();

  const showCountSeries = yMode === "count";

  rowsFiltered.slice(0, 200).forEach((row) => {
    const xSelection = selectionFor(selections, xKey);
    const yValRaw = yKey ? valueForRow(row, yKey) : undefined;
    const xRaw = valueForRow(row, xKey);
    const xAgeDays = xSelection?.mode === "ageing" ? ageInDays(xRaw) : null;
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
    if ((yMode === "ageing_days" || yMode === "date_diff") && yNum === null) {
      // Skip rows with null/invalid date-based metrics when required.
      return;
    }

    const xLabelRaw = xRaw;
    const xValueForLabel =
      isYDateLike &&
      (xLabelRaw === null || xLabelRaw === undefined || xLabelRaw === "")
        ? yNum
        : showCountSeries && xSelection?.mode === "ageing"
          ? (xAgeDays ?? xLabelRaw)
          : xLabelRaw;
    const xLabel =
      xSelection?.mode === "ageing" && typeof xValueForLabel === "number"
        ? ageingBucketFromDays(xValueForLabel, xSelection.values || [])
        : labelFor(xKey, xValueForLabel, xSelection);

    const groupLabelRaw = groupBy ? valueForRow(row, groupBy) : undefined;
    const groupLabel = groupBy
      ? labelFor(groupBy, groupLabelRaw, selectionFor(selections, groupBy))
      : "";

    const bucketLabel = groupBy ? `${xLabel} | ${groupLabel}` : xLabel;
    const bucketKey = groupBy ? `${xLabel}|||${groupLabel}` : xLabel;

    const yStr =
      yValRaw === null || yValRaw === undefined ? "(blank)" : String(yValRaw);

    if (!aggregated.has(bucketKey)) {
      aggregated.set(bucketKey, {
        label: bucketLabel,
        xLabel,
        groupLabel,
        yStrings: new Set<string>(),
        ySum: 0,
        yValueCount: 0,
        yHasValue: false,
        yMin: Number.POSITIVE_INFINITY,
        yMax: Number.NEGATIVE_INFINITY,
        count: 0,
      });
    }

    const entry = aggregated.get(bucketKey)!;
    if (yKey) {
      entry.yStrings.add(yStr);
    }
    if (yMode !== "count" && yNum !== null) {
      entry.ySum += yNum;
      entry.yValueCount += 1;
      entry.yHasValue = true;
      entry.yMin = Math.min(entry.yMin, yNum);
      entry.yMax = Math.max(entry.yMax, yNum);
    }
    if (showCountSeries) entry.count += 1;
  });

  ensureBuckets(aggregated, xKey, groupBy, selections, groupValues);

  const points = Array.from(aggregated.values()).map(
    ({
      label,
      xLabel,
      groupLabel,
      ySum,
      yHasValue,
      yValueCount,
      yMin,
      yMax,
      yStrings,
      count,
    }) => {
      const yValueNumeric =
        yHasValue && yValueCount > 0
          ? yAggregation === "avg"
            ? ySum / yValueCount
            : yAggregation === "min"
              ? yMin
              : yAggregation === "max"
                ? yMax
                : ySum
          : null;
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

  const showYSeries = yMode !== "count";

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
      .map((p) => [
        showYSeries ? (p.yValue ?? 0) : 0,
        showCountSeries ? p.count : 0,
      ])
      .flat()
      .filter((n) => Number.isFinite(n))
  );
  const chartType = chartConfig.chart_type || "bar";

  if (chartType === "pie") {
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

  const barContainerHeight = 200;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <span>
          {widgetTitle || "Chart"} ({chartType})
        </span>
        <span className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {showCountSeries && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Count
            </span>
          )}
          {showYSeries && (
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
                {showCountSeries && (
                  <div
                    className="flex flex-col items-center gap-1"
                    style={{ width: `${barWidth}px` }}
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-100">
                      {p.count}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-amber-500"
                      style={{ height: `${cHeightPx}px` }}
                    />
                  </div>
                )}
                {showYSeries && p.yValue !== null && (
                  <div
                    className="flex flex-col items-center gap-1 text-sky-500"
                    style={{ width: `${barWidth}px` }}
                  >
                    <span
                      className="font-semibold"
                      title={yDiffLabel || undefined}
                    >
                      {p.yValue}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-sky-500"
                      style={{
                        height: `${Math.max(8, (p.yValue / valueMax) * barContainerHeight)}px`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="w-40 text-center text-[11px]">
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

export default PreviewChart;
