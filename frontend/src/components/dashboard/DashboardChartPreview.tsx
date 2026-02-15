import React from "react";

export type DashboardChartConfig = {
  dataset_id?: string;
  x_field?: string;
  y_field?: string;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_values?: string[];
};

type DashboardChartPreviewProps = {
  title?: string;
  config: DashboardChartConfig;
  columns: string[];
  rows: Record<string, unknown>[];
};

const DashboardChartPreview: React.FC<DashboardChartPreviewProps> = ({
  title,
  config,
  columns,
  rows,
}) => {
  const groupBy = config.group_by || "";
  const groupValues = config.group_by_values || [];
  const filteredRows = rows.filter((row) => {
    if (!groupBy) return true;
    const key = row[groupBy];
    const label = key === null || key === undefined ? "(blank)" : String(key);
    return !groupValues.length || groupValues.includes(label);
  });

  const xKey = config.x_field || columns[0];
  const yKey = config.y_field;
  if (!xKey) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        Pick X (and Y) to see a chart.
      </div>
    );
  }

  const aggregated = new Map<
    string,
    {
      xLabel: string;
      groupLabel: string;
      yLabel: string;
      count: number;
    }
  >();

  filteredRows.forEach((row) => {
    const xRaw = row[xKey];
    const xLabel =
      xRaw === null || xRaw === undefined ? "(blank)" : String(xRaw);
    const gRaw = groupBy ? row[groupBy] : undefined;
    const gLabel = groupBy
      ? gRaw === null || gRaw === undefined
        ? "(blank)"
        : String(gRaw)
      : "";
    const yValRaw = yKey ? row[yKey] : undefined;
    const yLabel = yKey
      ? yValRaw === null || yValRaw === undefined
        ? "(blank)"
        : String(yValRaw)
      : "";

    const bucketKey = groupBy ? `${xLabel}|||${gLabel}` : xLabel;
    if (!aggregated.has(bucketKey)) {
      aggregated.set(bucketKey, {
        xLabel,
        groupLabel: gLabel,
        yLabel,
        count: 0,
      });
    }
    const entry = aggregated.get(bucketKey)!;
    entry.count += 1;
    if (yLabel && !entry.yLabel) entry.yLabel = yLabel;
  });

  const points = Array.from(aggregated.values());
  if (!points.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No data to chart.
      </div>
    );
  }

  const valueMax = Math.max(1, ...points.map((p) => p.count));
  const barHeight = 180;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div
        className="flex items-end gap-3 overflow-x-auto"
        style={{ minHeight: "220px" }}
      >
        {points.map((p, idx) => {
          const h = Math.max(8, (p.count / valueMax) * barHeight);
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
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {p.count}
                </div>
                {yKey && p.yLabel && (
                  <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                    {p.yLabel} ({p.count})
                  </div>
                )}
                <div
                  className="w-full rounded-t-md bg-amber-500"
                  style={{ height: `${h}px` }}
                />
              </div>
              <div className="w-32 text-center text-[11px]">
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

export default DashboardChartPreview;
