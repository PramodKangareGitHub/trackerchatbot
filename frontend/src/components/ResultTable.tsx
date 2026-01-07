import { useMemo, useState } from "react";

type Props = {
  columns: string[];
  rows: Record<string, unknown>[];
  onDrillDown?: (row: Record<string, unknown>, columns: string[]) => void;
  showChartToggle?: boolean;
  showCsvDownload?: boolean;
  question?: string;
};

const ResultTable = ({
  columns,
  rows,
  onDrillDown,
  showChartToggle = true,
  showCsvDownload = true,
  question,
}: Props) => {
  const [showChart, setShowChart] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  const drillableColumns = useMemo(
    () => columns.filter((c) => !/count/i.test(c)),
    [columns]
  );
  // Allow drilling even when the result is an aggregate (count-only); the handler can fall back to existing filters
  const drillAvailable = Boolean(onDrillDown);

  const chartData = useMemo(() => {
    if (!rows.length || !columns.length) return null;

    const numericCols = columns.filter((col) =>
      rows.every((row) => {
        const v = row[col];
        if (v === null || v === undefined || v === "") return true;
        const n = Number(v);
        return Number.isFinite(n);
      })
    );

    if (!numericCols.length) return null;

    // Prefer first non-numeric column as X labels; fallback to first column
    const xKey = columns.find((c) => !numericCols.includes(c)) || columns[0];
    const yKey = columns.find((c) => numericCols.includes(c)) || numericCols[0];
    if (!yKey) return null;

    const labels = rows.map((row, idx) =>
      String(row[xKey] ?? `Row ${idx + 1}`)
    );
    const values = rows.map((row) => {
      const num = Number(row[yKey]);
      return Number.isFinite(num) ? num : 0;
    });
    if (!labels.length || !values.length) return null;
    const max = Math.max(...values, 1);
    return { labels, values, max, xLabel: xKey || "X", yLabel: yKey || "Y" };
  }, [columns, rows]);

  const chartAvailable = Boolean(chartData);

  if (!columns.length) return null;
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        No rows to display yet.
      </div>
    );
  }

  const toCsvValue = (value: unknown) => {
    const raw = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const downloadCsv = () => {
    const header = columns.map(toCsvValue).join(",");
    const body = rows
      .map((row) => columns.map((col) => toCsvValue(row[col])).join(","))
      .join("\n");
    const csv = [header, body].filter(Boolean).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "results.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadChart = () => {
    if (!chartData) return;

    const { labels, values } = chartData;
    const colors = [
      "#0ea5e9",
      "#6366f1",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#8b5cf6",
      "#14b8a6",
      "#ec4899",
    ];

    const drawQuestion = (
      ctx: CanvasRenderingContext2D,
      text: string | undefined,
      width: number
    ) => {
      const content = (text || "").trim();
      if (!content) return 0;
      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      const maxWidth = Math.max(200, width - 40);
      const words = `Question: ${content}`.split(/\s+/);
      const lines: string[] = [];
      let current = "";
      words.forEach((w) => {
        const test = current ? `${current} ${w}` : w;
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      });
      if (current) lines.push(current);
      const capped = lines.slice(0, 3);
      const lineHeight = 16;
      capped.forEach((line, idx) => {
        ctx.fillText(line, 20, 24 + idx * lineHeight);
      });
      ctx.restore();
      return capped.length * lineHeight + 12;
    };

    if (chartType === "pie") {
      const width = 640;
      const baseHeight = 400;
      const measureCtx = document.createElement("canvas").getContext("2d");
      const headerHeight = measureCtx
        ? drawQuestion(measureCtx, question, width)
        : 0;
      const paddingTop = 24 + headerHeight;
      const radius = 140;
      const cy = paddingTop + radius;
      const cx = 200;
      const legendStartY = paddingTop;
      const height = Math.max(
        baseHeight,
        cy + radius + 20,
        legendStartY + labels.length * 18 + 20
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      drawQuestion(ctx, question, width);
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let start = -Math.PI / 2;
      values.forEach((val, idx) => {
        const slice = (val / total) * Math.PI * 2;
        const end = start + slice;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        start = end;
      });

      // Legend
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      labels.forEach((label, idx) => {
        const y = legendStartY + idx * 18;
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fillRect(380, y - 10, 12, 12);
        ctx.fillStyle = "#0f172a";
        ctx.fillText(`${values[idx]} - ${label}`, 400, y);
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "chart.png";
        link.click();
        URL.revokeObjectURL(url);
      });
      return;
    }

    // Bar chart export
    const width = Math.max(600, labels.length * 80);
    const measureCtx = document.createElement("canvas").getContext("2d");
    const headerHeight = measureCtx
      ? drawQuestion(measureCtx, question, width)
      : 0;
    const height = 360 + headerHeight + 10;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1;

    const padding = 50;
    drawQuestion(ctx, question, width);

    const maxVal = Math.max(...values, 1);
    const chartHeight = height - padding * 2 - headerHeight;
    const barWidth = Math.max(20, (width - padding * 2) / values.length - 10);

    const wrapLabel = (text: string, maxWidth: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let current = "";
      words.forEach((w) => {
        const test = current ? `${current} ${w}` : w;
        if (ctx.measureText(test).width <= maxWidth) {
          current = test;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      });
      if (current) lines.push(current);
      return lines.slice(0, 3); // cap at 3 lines
    };

    values.forEach((val, idx) => {
      const x = padding + idx * (barWidth + 10);
      const barHeight = (val / maxVal) * chartHeight;
      const y = height - padding - barHeight;
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = "#1f2937";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(val), x + barWidth / 2, y - 6);

      const labelLines = wrapLabel(String(labels[idx]), barWidth + 24);
      ctx.font = "11px sans-serif";
      labelLines.forEach((line, lineIdx) => {
        ctx.fillText(
          line,
          x + barWidth / 2,
          height - padding + 14 + lineIdx * 12
        );
      });
    });

    ctx.strokeRect(
      padding - 4,
      padding - 4,
      width - padding * 2 + 8,
      height - padding * 2 + 8
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "chart.png";
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Results
        </span>
        {(showChartToggle || showCsvDownload) && (
          <div className="flex flex-wrap items-center gap-2">
            {showChartToggle && (
              <>
                <button
                  type="button"
                  onClick={() => setShowChart((prev) => !prev)}
                  disabled={!chartAvailable}
                  className="btn-outline-primary px-3 py-1 text-xs disabled:opacity-50"
                >
                  {showChart ? "Hide Chart" : "Show Chart"}
                </button>
                {showChart && chartAvailable && (
                  <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
                    <button
                      type="button"
                      onClick={() => setChartType("bar")}
                      className={`rounded-md px-2 py-1 ${
                        chartType === "bar"
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                      }`}
                    >
                      Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartType("pie")}
                      className={`rounded-md px-2 py-1 ${
                        chartType === "pie"
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
                      }`}
                    >
                      Pie
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={downloadChart}
                  disabled={!chartAvailable}
                  className="btn-outline-primary px-3 py-1 text-xs disabled:opacity-50"
                >
                  Download Chart
                </button>
              </>
            )}
            {showCsvDownload && (
              <button
                type="button"
                onClick={downloadCsv}
                className="btn-outline-primary px-3 py-1 text-xs"
              >
                Download CSV
              </button>
            )}
          </div>
        )}
      </div>
      {showChartToggle && showChart && chartData && (
        <div className="overflow-x-auto border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
            <span>X: {chartData.xLabel}</span>
            <span>Y: {chartData.yLabel}</span>
          </div>
          {chartType === "bar" ? (
            <div className="flex items-end gap-3" style={{ minWidth: "520px" }}>
              {chartData.values.map((val, idx) => {
                const heightPct = (val / chartData.max) * 100;
                const labelText = String(chartData.labels[idx]);
                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-2 text-xs text-slate-600 dark:text-slate-200"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-100">
                      {val}
                    </span>
                    <div className="flex h-40 w-12 items-end">
                      <div
                        className="w-full rounded-t-md bg-sky-500"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="w-24 break-words text-center text-[11px] text-slate-500 dark:text-slate-300">
                      {labelText}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row">
              <svg
                width="320"
                height="240"
                viewBox="0 0 320 240"
                role="img"
                aria-label="Pie chart"
              >
                <circle cx="120" cy="120" r="110" fill="#e2e8f0" />
                {(() => {
                  const total =
                    chartData.values.reduce((a, b) => a + b, 0) || 1;
                  let startAngle = -Math.PI / 2;
                  return chartData.values.map((val, idx) => {
                    const sliceAngle = (val / total) * Math.PI * 2;
                    const endAngle = startAngle + sliceAngle;
                    const largeArc = sliceAngle > Math.PI ? 1 : 0;
                    const x1 = 120 + 110 * Math.cos(startAngle);
                    const y1 = 120 + 110 * Math.sin(startAngle);
                    const x2 = 120 + 110 * Math.cos(endAngle);
                    const y2 = 120 + 110 * Math.sin(endAngle);
                    const d = `M120,120 L${x1},${y1} A110,110 0 ${largeArc} 1 ${x2},${y2} z`;
                    startAngle = endAngle;
                    const colors = [
                      "#0ea5e9",
                      "#6366f1",
                      "#10b981",
                      "#f59e0b",
                      "#ef4444",
                      "#8b5cf6",
                      "#14b8a6",
                      "#ec4899",
                    ];
                    const fill = colors[idx % colors.length];
                    return (
                      <path
                        key={idx}
                        d={d}
                        fill={fill}
                        stroke="#fff"
                        strokeWidth={1}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="flex flex-1 flex-wrap gap-3 text-[12px] text-slate-700 dark:text-slate-200">
                {chartData.values.map((val, idx) => {
                  const colors = [
                    "#0ea5e9",
                    "#6366f1",
                    "#10b981",
                    "#f59e0b",
                    "#ef4444",
                    "#8b5cf6",
                    "#14b8a6",
                    "#ec4899",
                  ];
                  const fill = colors[idx % colors.length];
                  const labelText = String(chartData.labels[idx]);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-800"
                    >
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ background: fill }}
                      />
                      <span className="font-semibold">{val}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-300">
                        {labelText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-4 py-3 font-semibold"
                >
                  {col}
                </th>
              ))}
              {drillAvailable && (
                <th className="whitespace-nowrap px-4 py-3 font-semibold">
                  Drill
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/60"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="whitespace-nowrap px-4 py-2 text-slate-800 dark:text-slate-100"
                  >
                    {String(row[col] ?? "")}
                  </td>
                ))}
                {drillAvailable && (
                  <td className="whitespace-nowrap px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onDrillDown?.(row, columns)}
                      className="btn-outline-primary px-3 py-1 text-xs"
                    >
                      View rows
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultTable;
