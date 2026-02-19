import ResultTable from "../../ResultTable";
import type { TableConfig } from "../types";

export type PreviewTableProps = {
  tableConfig: TableConfig;
  data: { columns: string[]; rows: Record<string, unknown>[] };
};

const isAgeing = (col: string) =>
  col.toLowerCase().replace(/[^a-z0-9]+/g, "_") === "ageing_as_on_today";

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
  const label =
    rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
  return groupValues.includes(label);
};

const PreviewTable = ({ tableConfig, data }: PreviewTableProps) => {
  const groupBy = tableConfig.group_by || "";
  const groupValues = tableConfig.group_by_values || [];

  if (groupBy) {
    const filteredRows = data.rows.filter((row) => {
      const key = row[groupBy];
      return matchesGroup(groupBy, groupValues, key);
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
      const groupLabel = isAgeing(groupBy)
        ? bucketAgeLabel(groupKeyRaw)
        : groupKeyRaw === null || groupKeyRaw === undefined
          ? "(blank)"
          : String(groupKeyRaw);

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
  const rows = data.rows.slice(0, 50).map((row) => {
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
