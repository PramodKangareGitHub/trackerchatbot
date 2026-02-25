import ResultTable from "../../ResultTable";
import type { TableConfig } from "../types";

export type PreviewTableProps = {
  tableConfig: TableConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

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

const PreviewTable = ({ tableConfig, data }: PreviewTableProps) => {
  const groupBy = tableConfig.group_by || "";
  const groupValues = tableConfig.group_by_values || [];
  const filterBy = tableConfig.filter_by || "";
  const filterValues = tableConfig.filter_values || [];

  const matchesSelection = (col: string, values: string[], rowVal: unknown) => {
    if (!values.length) return true;
    if (isAgeing(col)) {
      const num = Number(rowVal);
      if (!Number.isFinite(num)) return false;
      return values.some((gv) => matchesAgeRange(num, gv));
    }
    if (isDateCol(col)) {
      const quarterLabel = toQuarterLabel(rowVal);
      const dayLabel = toLabel(col, ["0-30"], rowVal); // uses day path
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

  if (groupBy) {
    const filteredRows = rowsAfterFilter.filter((row) => {
      const key = row[groupBy];
      return matchesSelection(groupBy, groupValues, key);
    });

    const showGroupColumn = groupValues.length !== 1;
    const baseColumns = tableConfig.fields?.length
      ? tableConfig.fields
      : data.columns;
    const columns = baseColumns.filter((c) => c);
    const finalColumns = showGroupColumn
      ? Array.from(new Set([...columns, groupBy, "count"]))
      : Array.from(new Set([...columns.filter((c) => c !== groupBy), "count"]));

    const grouped = new Map<
      string,
      { count: number; row: Record<string, unknown> }
    >();

    filteredRows.forEach((row) => {
      const groupKeyRaw = row[groupBy];
      const groupLabel = toLabel(groupBy, groupValues, groupKeyRaw);

      const keyParts = [
        groupLabel,
        ...columns.map((c) => String(row[c] ?? "")),
      ];
      const key = keyParts.join("|");

      if (!grouped.has(key)) {
        const baseRow: Record<string, unknown> = {};
        columns.forEach((c) => {
          baseRow[c] = row[c];
        });
        if (showGroupColumn) {
          baseRow[groupBy] = groupLabel;
        }
        grouped.set(key, { count: 0, row: baseRow });
      }

      const entry = grouped.get(key)!;
      entry.count += 1;
    });

    const rows = Array.from(grouped.values()).map(({ count, row }) => ({
      ...row,
      count,
    }));

    return (
      <ResultTable
        columns={finalColumns}
        rows={rows}
        showChartToggle={false}
        showCsvDownload={false}
      />
    );
  }

  const baseColumns = tableConfig.fields?.length
    ? tableConfig.fields
    : data.columns;
  const columns = baseColumns.filter((c) => c);
  const rows = rowsAfterFilter.slice(0, 50).map((row) => {
    const trimmed: Record<string, unknown> = {};
    columns.forEach((c) => {
      trimmed[c] = row[c];
    });
    return trimmed;
  });

  return (
    <ResultTable
      columns={columns}
      rows={rows}
      showChartToggle={false}
      showCsvDownload={false}
    />
  );
};

export default PreviewTable;
