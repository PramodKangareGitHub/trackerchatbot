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

const normalize = (col: string) =>
  col.toLowerCase().replace(/[^a-z0-9]+/g, "_");
const isAgeing = (col: string) => normalize(col) === "ageing_as_on_today";
const isDateCol = (col: string) => normalize(col) === "jp_posting_date_to_hcl";
const hasQuarterVal = (values: string[]) =>
  values.some((v) => /^Q[1-4]$/.test(v));
const hasDayRangeVal = (values: string[]) =>
  values.some((v) => /^\d+\s*-\s*\d+$/.test(v) || /^\d+\+$/.test(v));

const bucketAgeLabel = (val: unknown) => {
  const num = Number(val);
  if (!Number.isFinite(num)) {
    return val === null || val === undefined ? "(blank)" : String(val);
  }
  if (num <= 30) return "0-30";
  if (num <= 60) return "30-60";
  if (num <= 90) return "60-90";
  return "90+";
};

const matchesAgeRange = (num: number, label: string) => {
  const trimmed = label.trim();
  const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const low = Number(rangeMatch[1]);
    const high = Number(rangeMatch[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return false;
    return num >= low && num <= high;
  }
  if (/^(90\+)$/.test(trimmed)) {
    return num >= 90;
  }
  return String(num) === trimmed;
};

const toQuarterLabel = (val: unknown) => {
  if (val === null || val === undefined) return "(blank)";
  const parsed = new Date(String(val));
  if (Number.isNaN(parsed.getTime())) return String(val);
  const q = Math.floor(parsed.getMonth() / 3) + 1;
  if (q < 1 || q > 4) return String(val);
  return `Q${q}`;
};

const toLabel = (col: string, selectedValues: string[], val: unknown) => {
  if (isAgeing(col)) return bucketAgeLabel(val);
  if (isDateCol(col)) {
    const quarterLabel = toQuarterLabel(val);
    const dayLabel = (() => {
      if (val === null || val === undefined) return "(blank)";
      const parsed = new Date(String(val));
      if (Number.isNaN(parsed.getTime())) return String(val);
      const diffMs = Date.now() - parsed.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (!Number.isFinite(diffDays)) return String(val);
      if (diffDays <= 30) return "0-30";
      if (diffDays <= 60) return "31-60";
      if (diffDays <= 90) return "61-90";
      return "90+";
    })();
    const hasDay = hasDayRangeVal(selectedValues);
    const hasQuarter = hasQuarterVal(selectedValues);
    if (hasDay && hasQuarter) {
      if (selectedValues.includes(dayLabel)) return dayLabel;
      if (selectedValues.includes(quarterLabel)) return quarterLabel;
      return dayLabel;
    }
    if (hasDay) return dayLabel;
    if (hasQuarter) return quarterLabel;
  }
  return val === null || val === undefined ? "(blank)" : String(val);
};

const matchesGroup = (
  groupBy: string,
  groupValues: string[],
  rowVal: unknown
) => {
  if (!groupValues.length) return true;
  if (isAgeing(groupBy)) {
    const num = Number(rowVal);
    if (!Number.isFinite(num)) return false;
    return groupValues.some((gv) => matchesAgeRange(num, gv));
  }
  if (isDateCol(groupBy)) {
    const quarterLabel = toQuarterLabel(rowVal);
    const dayLabel = toLabel(groupBy, ["0-30"], rowVal);
    const rawLabel =
      rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
    return groupValues.some(
      (v) => v === quarterLabel || v === dayLabel || v === rawLabel
    );
  }
  const label = toLabel(groupBy, groupValues, rowVal);
  return groupValues.includes(label);
};

const PreviewChart = ({
  widgetTitle,
  chartConfig,
  data,
}: PreviewChartProps) => {
  const groupBy = chartConfig.group_by || "";
  const groupValues = chartConfig.group_by_values || [];
  const filterBy = chartConfig.filter_by || "";
  const filterValues = chartConfig.filter_values || [];

  const matchesSelection = (col: string, values: string[], rowVal: unknown) => {
    if (!values.length) return true;
    if (isAgeing(col)) {
      const num = Number(rowVal);
      if (!Number.isFinite(num)) return false;
      return values.some((gv) => matchesAgeRange(num, gv));
    }
    if (isDateCol(col)) {
      const quarterLabel = toQuarterLabel(rowVal);
      const dayLabel = toLabel(col, ["0-30"], rowVal);
      const rawLabel =
        rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
      return values.some(
        (v) => v === quarterLabel || v === dayLabel || v === rawLabel
      );
    }
    const label = toLabel(col, values, rowVal);
    return values.includes(label);
  };

  const rowsAfterFilter = filterBy
    ? data.rows.filter((row) =>
        matchesSelection(filterBy, filterValues, row[filterBy])
      )
    : data.rows;

  const rowsFiltered = rowsAfterFilter.filter((row) => {
    if (!groupBy) return true;
    const key = row[groupBy];
    return matchesGroup(groupBy, groupValues, key);
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
      ? toLabel(groupBy, groupValues, groupLabelRaw)
      : "";

    const bucketLabel = groupBy ? `${xLabel} | ${groupLabel}` : xLabel;
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

export default PreviewChart;
