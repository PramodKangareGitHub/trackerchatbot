export type BannerConfig = {
  id: string;
  dashboard_id?: string;
  dataset_id: string;
  column: string;
  label?: string;
  values?: string[];
  op?: string;
  operator?: string;
  filters?: {
    table?: string;
    field: string;
    op?: string;
    operator?: string;
    values?: string[];
  }[];
  role?: string;
};

export type BannerValueCount = { value: string; count: number };
export type BannerCountsResult = { counts: BannerValueCount[]; total: number };

// Special pseudo-column to count entire table rows without grouping by a field.
export const TABLE_TOTAL_COLUMN = "__table_total__";

export const BANNER_STORAGE_KEY = "banner-configs-v1";

export const formatDatasetName = (name: string) => {
  if (!name) return "";
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned || withoutExt;
};

export const readStoredBannerConfigs = (): BannerConfig[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(BANNER_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item.id || ""),
        dashboard_id: item.dashboard_id ? String(item.dashboard_id) : undefined,
        dataset_id: String(item.dataset_id || ""),
        column: String(item.column || ""),
        label: item.label ? String(item.label) : undefined,
        values: Array.isArray(item.values)
          ? item.values.map((v) => String(v))
          : undefined,
        op: item.op
          ? String(item.op)
          : item.operator
            ? String(item.operator)
            : undefined,
        operator: item.operator ? String(item.operator) : undefined,
        filters: Array.isArray(item.filters)
          ? item.filters
              .map((f: any) => ({
                table: f?.table ? String(f.table) : undefined,
                field: f?.field ? String(f.field) : "",
                op: f?.op
                  ? String(f.op)
                  : f?.operator
                    ? String(f.operator)
                    : undefined,
                operator: f?.operator ? String(f.operator) : undefined,
                values: Array.isArray(f?.values)
                  ? f.values.map((v: any) => String(v))
                  : undefined,
              }))
              .filter((f: any) => f.field)
          : undefined,
        role: item.role ? String(item.role).toLowerCase() : undefined,
      }))
      .filter((item) => item.id && item.dataset_id && item.column);
  } catch {
    return [];
  }
};

export const persistBannerConfigs = (configs: BannerConfig[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BANNER_STORAGE_KEY, JSON.stringify(configs));
};

type FetchCountsArgs = {
  apiBase: string;
  authToken: string;
  datasetId: string;
  column: string;
  filterOp?: string;
  filterValues?: string[];
  filters?: {
    table?: string;
    field: string;
    op?: string;
    operator?: string;
    values?: string[];
  }[];
};

export const fetchValueCounts = async ({
  apiBase,
  authToken,
  datasetId,
  column,
  filterOp,
  filterValues,
  filters,
}: FetchCountsArgs): Promise<BannerCountsResult> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
  };
  const pageSize = 200;
  let offset = 0;
  let total = Infinity;
  const counts = new Map<string, number>();

  while (offset < total) {
    const params = new URLSearchParams();
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    const joinSet = new Set<string>();
    const allFilters: {
      table?: string;
      field: string;
      op?: string;
      values?: string[];
    }[] = [];
    const hasFilterValues =
      column !== TABLE_TOTAL_COLUMN &&
      Array.isArray(filterValues) &&
      filterValues.length;
    if (hasFilterValues) {
      const op = (filterOp || "in").toLowerCase();
      allFilters.push({ field: column, op, values: filterValues });
    }
    (filters || []).forEach((f) => {
      if (!f || !f.field) return;
      const values = Array.isArray(f.values)
        ? f.values.map((v) => String(v)).filter((v) => v.trim().length)
        : [];
      if (!values.length) return;
      const op = (f.op || f.operator || "in").toLowerCase();
      allFilters.push({ table: f.table, field: f.field, op, values });
      if (f.table && f.table !== datasetId) {
        joinSet.add(f.table);
      }
    });

    allFilters.forEach((f) => {
      params.append(
        "filters",
        JSON.stringify({
          table: f.table,
          field: f.field,
          op: f.op || "in",
          values: f.values,
        })
      );
    });

    Array.from(joinSet)
      .filter(Boolean)
      .forEach((t) => params.append("joined_tables", t));

    const res = await fetch(
      `${apiBase}/api/admin/datasets/${datasetId}/records?${params.toString()}`,
      { headers }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        body.detail || res.statusText || "Failed to load banner counts"
      );
    }
    const data: { rows?: Record<string, unknown>[]; total?: number } =
      await res.json();
    const rows = data.rows || [];
    if (Number.isFinite(data.total)) {
      total = data.total as number;
    }

    if (column === TABLE_TOTAL_COLUMN) {
      counts.set("Total", Number(total) || 0);
      break;
    }

    rows.forEach((row) => {
      const record = row as Record<string, unknown>;
      const columnKeys = [column];
      if (!column.includes(".")) {
        columnKeys.push(`${datasetId}.${column}`);
      }

      const keyName = columnKeys.find((c) => c in record);
      const raw = keyName ? record[keyName] : undefined;
      const key = raw === null || raw === undefined ? "(blank)" : String(raw);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    offset += rows.length;
    if (!rows.length) break;
    if (!Number.isFinite(total)) {
      total = offset + 1;
    }
  }

  let result = Array.from(counts.entries()).map(([value, count]) => ({
    value,
    count,
  }));

  result.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });

  return { counts: result, total: Number(total) || 0 };
};
