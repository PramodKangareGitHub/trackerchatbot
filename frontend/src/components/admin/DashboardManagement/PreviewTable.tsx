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
const quarterMatch = (v: string) => {
  const m = v.match(/^Q([1-4])(?:\s+(\d{4}))?$/i);
  if (!m) return null;
  const q = Number(m[1]);
  const yr = m[2] ? Number(m[2]) : null;
  return { q, year: yr };
};
const hasQuarterVal = (values: string[]) =>
  values.some((v) => Boolean(quarterMatch(v)));
const hasQuarterValWithYear = (values: string[]) =>
  values.some((v) => Boolean(quarterMatch(v)?.year));
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

const toQuarterLabel = (val: unknown, withYear = false) => {
  if (val === null || val === undefined) return "(blank)";
  const parsed = new Date(String(val));
  if (Number.isNaN(parsed.getTime())) return String(val);
  const q = Math.floor(parsed.getUTCMonth() / 3) + 1;
  const year = parsed.getUTCFullYear();
  if (q < 1 || q > 4 || !Number.isFinite(year)) return String(val);
  return withYear ? `Q${q} ${year}` : `Q${q}`;
};

const toLabel = (col: string, selectedValues: string[], val: unknown) => {
  if (isAgeing(col)) return bucketAgeLabel(val);
  if (isDateCol(col)) {
    const quarterLabel = toQuarterLabel(val, false);
    const quarterLabelYear = toQuarterLabel(val, true);
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
    const hasQuarterYear = hasQuarterValWithYear(selectedValues);
    if (hasDay && hasQuarter) {
      if (selectedValues.includes(dayLabel)) return dayLabel;
      if (hasQuarterYear && selectedValues.includes(quarterLabelYear))
        return quarterLabelYear;
      if (selectedValues.includes(quarterLabel)) return quarterLabel;
      if (hasQuarterYear) return quarterLabelYear;
      return dayLabel;
    }
    if (hasDay) return dayLabel;
    if (hasQuarter) return hasQuarterYear ? quarterLabelYear : quarterLabel;
  }
  return val === null || val === undefined ? "(blank)" : String(val);
};

const PreviewTable = ({ tableConfig, data }: PreviewTableProps) => {
  const groupBy = tableConfig.group_by || "";
  const groupValues = tableConfig.group_by_values || [];
  const filterBy = tableConfig.filter_by || "";
  const filterValues = tableConfig.filter_values || [];
  const activeFilters = (tableConfig.filters || [])
    .filter(
      (f) => f.field && (Array.isArray(f.value) ? f.value.length : f.value)
    )
    .map((f) => {
      const col = f.field || "";
      const prefixed =
        f.table && !col.includes(".") ? `${f.table}.${col}` : col;
      const rawValues = Array.isArray(f.value) ? f.value : [f.value];
      const values = rawValues
        .map((v) => String(v))
        .filter((v) => v.trim().length);
      const op = (f.op || f.operator || "in").toLowerCase();
      return { ...f, column: prefixed, values, op };
    })
    .filter((f) => (f.values || []).length);

  const valueFor = (row: Record<string, unknown>, col: string) => {
    if (col in row) return row[col];
    const suffix = col.includes(".") ? col.split(".").slice(-1)[0] : col;
    return row[suffix];
  };

  const matchesSelection = (col: string, values: string[], rowVal: unknown) => {
    if (!values.length) return true;
    const norm = (v: unknown) =>
      typeof v === "string"
        ? v.trim().toLowerCase()
        : String(v ?? "")
            .trim()
            .toLowerCase();
    if (isAgeing(col)) {
      const num = Number(rowVal);
      if (!Number.isFinite(num)) return false;
      return values.some((gv) => matchesAgeRange(num, gv));
    }
    if (isDateCol(col)) {
      const quarterLabel = toQuarterLabel(rowVal, false);
      const quarterLabelYear = toQuarterLabel(rowVal, true);
      const dayLabel = toLabel(col, ["0-30"], rowVal); // uses day path
      const rawLabel =
        rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
      return values.some(
        (v) =>
          norm(v) === norm(quarterLabel) ||
          norm(v) === norm(quarterLabelYear) ||
          norm(v) === norm(dayLabel) ||
          norm(v) === norm(rawLabel)
      );
    }
    const label = toLabel(col, values, rowVal);
    return values.some((v) => norm(v) === norm(label));
  };

  const normalizeOp = (op?: string) => {
    const o = (op || "").toLowerCase();
    if (o === "!=") return "not_in";
    if (o === "=") return "in";
    if (o === "neq") return "not_in";
    if (o === "eq") return "in";
    return o || "in";
  };

  const normalizeValue = (v: unknown) =>
    typeof v === "string"
      ? v.trim().toLowerCase()
      : String(v ?? "")
          .trim()
          .toLowerCase();

  const toNumeric = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    const num = Number(v);
    if (Number.isFinite(num)) return num;
    const dt = new Date(String(v));
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
    return null;
  };

  const matchesFilterOp = (
    col: string,
    op: string,
    values: string[],
    rowVal: unknown
  ) => {
    const normalizedOp = normalizeOp(op);
    const rowLabel = toLabel(col, values, rowVal);
    const rowNorm = normalizeValue(rowLabel);
    const normVals = values
      .map((v) => normalizeValue(v))
      .filter((v) => v.length);

    if (!normVals.length) return true;

    if (
      normalizedOp === "between" ||
      normalizedOp === ">" ||
      normalizedOp === ">=" ||
      normalizedOp === "<" ||
      normalizedOp === "<="
    ) {
      const rowNum = toNumeric(rowVal);
      const nums = values
        .map((v) => toNumeric(v))
        .filter((v): v is number => v !== null);
      if (rowNum === null || !nums.length) return false;
      if (normalizedOp === "between") {
        if (nums.length >= 2 && nums[1] !== undefined) {
          return rowNum >= nums[0] && rowNum <= nums[1];
        }
        return rowNum >= nums[0];
      }
      const target = nums[0];
      if (target === undefined) return false;
      if (normalizedOp === ">") return rowNum > target;
      if (normalizedOp === ">=") return rowNum >= target;
      if (normalizedOp === "<") return rowNum < target;
      return rowNum <= target;
    }

    if (normalizedOp === "contains") {
      return normVals.some((v) => rowNorm.includes(v));
    }

    if (normalizedOp === "not_in") {
      if (rowVal === null || rowVal === undefined || rowNorm === "")
        return true;
      return normVals.every((v) => v !== rowNorm);
    }

    return normVals.some((v) => v === rowNorm);
  };

  const rowsAfterFilter = data.rows.filter((row) => {
    const primaryMatches = filterBy
      ? matchesSelection(filterBy, filterValues, valueFor(row, filterBy))
      : true;
    if (!primaryMatches) return false;

    if (!activeFilters.length) return true;

    return activeFilters.every((f) =>
      matchesFilterOp(
        f.column || f.field || "",
        f.op,
        f.values,
        valueFor(row, f.column || f.field || "")
      )
    );
  });

  if (groupBy) {
    const filteredRows = rowsAfterFilter.filter((row) => {
      const key = valueFor(row, groupBy);
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
      const groupKeyRaw = valueFor(row, groupBy);
      const groupLabel = toLabel(groupBy, groupValues, groupKeyRaw);

      const keyParts = [
        groupLabel,
        ...columns.map((c) => String(valueFor(row, c) ?? "")),
      ];
      const key = keyParts.join("|");

      if (!grouped.has(key)) {
        const baseRow: Record<string, unknown> = {};
        columns.forEach((c) => {
          baseRow[c] = valueFor(row, c);
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
      trimmed[c] = valueFor(row, c);
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
