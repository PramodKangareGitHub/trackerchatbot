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
  const str = String(val);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let month: number | null = null;
  let year: number | null = null;
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]) - 1;
  } else {
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      month = parsed.getUTCMonth();
      year = parsed.getUTCFullYear();
    }
  }
  if (month === null || year === null || month < 0 || month > 11) return str;
  let q: number;
  let fy = year;
  if (month >= 3 && month <= 5) {
    q = 1;
    fy = year;
  } else if (month >= 6 && month <= 8) {
    q = 2;
    fy = year;
  } else if (month >= 9 && month <= 11) {
    q = 3;
    fy = year;
  } else {
    q = 4;
    fy = year - 1;
  }
  if (!Number.isFinite(fy)) return String(val);
  return withYear ? `Q${q} FY${fy}` : `Q${q}`;
};

const toLabel = (col: string, selectedValues: string[], val: unknown) => {
  if (isAgeing(col)) return bucketAgeLabel(val);

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
    if (diffDays <= 90) return "60-90";
    return "90+";
  })();

  const hasDay = hasDayRangeVal(selectedValues);
  const hasQuarter = hasQuarterVal(selectedValues);
  const hasQuarterYear = hasQuarterValWithYear(selectedValues);

  if (isDateCol(col) || hasDay || hasQuarter) {
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
  const isRangeAgg =
    (data.columns || []).includes("range") &&
    (data.columns || []).includes("count");
  const ageingFields = (tableConfig.filters || [])
    .filter((f) => (f.op || f.operator || "").toLowerCase() === "ageing_range")
    .map((f) => {
      const field = f.field || "";
      if (field.includes(".")) return field;
      const table = f.table || tableConfig.dataset_id || "";
      return table ? `${table}.${field}` : field;
    });
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

  const ageingSelections = activeFilters
    .filter((f) => f.op === "ageing_range" || f.op === "quarter")
    .reduce<Map<string, string[]>>((map, f) => {
      if (f.column) {
        const vals = f.values || [];
        map.set(f.column, vals);
        const suffix = f.column.includes(".")
          ? f.column.split(".").slice(-1)[0]
          : f.column;
        if (suffix) map.set(suffix, vals);
      }
      return map;
    }, new Map());

  const formatWithAgeingContext = (
    col: string,
    selection: string[],
    rawVal: unknown
  ) => {
    const label = toLabel(col, selection, rawVal);
    const isRange = selection.every((v) => /^\d+\s*-\s*\d+$/.test(v));
    if (selection.length && isRange) {
      const primary = selection.length === 1 ? selection[0] : label;
      return `Ageing: ${primary} days`;
    }
    return label;
  };

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
    if (rowVal === undefined) {
      // Column missing from this row (likely joined-table filter). Trust server-side filter.
      return true;
    }
    const normalizedOp = normalizeOp(op);
    const rowLabel = toLabel(col, values, rowVal);
    const rowNorm = normalizeValue(rowLabel);
    const normVals = values
      .map((v) => normalizeValue(v))
      .filter((v) => v.length);

    if (!normVals.length) return true;

    if (normalizedOp === "ageing_range") {
      // Accept either raw date or a precomputed age (number of days).
      const asNumber = Number(rowVal);
      const fromNumber = Number.isFinite(asNumber) ? asNumber : null;
      const dt = new Date(String(rowVal));
      const fromDate = Number.isNaN(dt.getTime())
        ? null
        : Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
      const diffDays = fromNumber ?? fromDate;
      if (diffDays === null) return true; // do not hide rows if parsing fails
      return values.some((v) => matchesAgeRange(diffDays, v));
    }

    if (normalizedOp === "quarter") {
      const quarterLabel = toQuarterLabel(rowVal, false);
      const quarterLabelYear = toQuarterLabel(rowVal, true);
      return normVals.some(
        (v) =>
          v === normalizeValue(quarterLabel) ||
          v === normalizeValue(quarterLabelYear)
      );
    }

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

  const rowsAfterFilter = isRangeAgg
    ? data.rows
    : data.rows.filter((row) => {
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

  if (groupBy && !isRangeAgg) {
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
      const selectionForGroup = ageingSelections.get(groupBy) || groupValues;
      const groupLabel = formatWithAgeingContext(
        groupBy,
        selectionForGroup,
        groupKeyRaw
      );

      const keyParts = [
        groupLabel,
        ...columns.map((c) => {
          const selection = ageingSelections.get(c) || [];
          const rawVal = valueFor(row, c);
          if (!selection.length) return String(rawVal ?? "");
          return String(formatWithAgeingContext(c, selection, rawVal));
        }),
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
  const columns = (() => {
    if (isRangeAgg) {
      const cols = data.columns || baseColumns || [];
      const drop = new Set(
        ageingFields.flatMap((c) => [c, c.split(".").slice(-1)[0]])
      );
      return cols.filter((c) => !drop.has(c));
    }
    const trimmed = baseColumns.filter((c) => c);
    if (!trimmed.length) return data.columns || [];
    const sampleRow = rowsAfterFilter[0] || data.rows[0] || {};
    const hasAny = trimmed.some(
      (c) => c in sampleRow || c.split(".").slice(-1)[0] in sampleRow
    );
    return hasAny ? trimmed : data.columns || trimmed;
  })();
  const collapseRangeRows = (input: Record<string, unknown>[]) => {
    const keyCols = columns.filter((c) => c !== "count");
    if (!keyCols.length) return input;
    const grouped = new Map<
      string,
      { row: Record<string, unknown>; count: number }
    >();
    input.forEach((row) => {
      const keyParts = keyCols.map((c) => {
        const selection =
          ageingSelections.get(c) ||
          ageingSelections.get(c.split(".").slice(-1)[0]) ||
          [];
        const rawVal = valueFor(row, c);
        const display = selection.length
          ? formatWithAgeingContext(c, selection, rawVal)
          : rawVal;
        return display === null || display === undefined ? "" : String(display);
      });
      const key = keyParts.join("|");
      const rowCount = Number(valueFor(row, "count")) || 0;
      if (grouped.has(key)) {
        grouped.get(key)!.count += rowCount;
      } else {
        const base: Record<string, unknown> = {};
        keyCols.forEach((c) => {
          const selection =
            ageingSelections.get(c) ||
            ageingSelections.get(c.split(".").slice(-1)[0]) ||
            [];
          const rawVal = valueFor(row, c);
          base[c] = selection.length
            ? formatWithAgeingContext(c, selection, rawVal)
            : rawVal;
        });
        grouped.set(key, { row: base, count: rowCount });
      }
    });
    return Array.from(grouped.values()).map(({ row, count }) => ({
      ...row,
      count,
    }));
  };

  const sourceRows = isRangeAgg
    ? collapseRangeRows(data.rows)
    : rowsAfterFilter.slice(0, 50);

  const rows = sourceRows.map((row) => {
    const trimmed: Record<string, unknown> = {};
    columns.forEach((c) => {
      const selection = ageingSelections.get(c) || [];
      const rawVal = valueFor(row, c);
      trimmed[c] = selection.length
        ? formatWithAgeingContext(c, selection, rawVal)
        : rawVal;
    });
    return trimmed;
  });

  const finalRows = rows.length
    ? rows
    : columns.length
      ? [Object.fromEntries(columns.map((c) => [c, 0]))]
      : [{ value: 0 }];

  return (
    <ResultTable
      columns={columns}
      rows={finalRows}
      showChartToggle={false}
      showCsvDownload={false}
    />
  );
};

export default PreviewTable;
