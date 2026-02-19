export type BannerConfig = {
  id: string;
  dashboard_id?: string;
  dataset_id: string;
  column: string;
  label?: string;
  values?: string[];
  role?: string;
};

export type BannerValueCount = { value: string; count: number };

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
  allowedValues?: string[];
};

export const fetchValueCounts = async ({
  apiBase,
  authToken,
  datasetId,
  column,
  allowedValues,
}: FetchCountsArgs): Promise<BannerValueCount[]> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${authToken}`,
  };
  const pageSize = 200;
  let offset = 0;
  let total = Infinity;
  const counts = new Map<string, number>();

  while (offset < total) {
    const res = await fetch(
      `${apiBase}/api/admin/datasets/${datasetId}/records?limit=${pageSize}&offset=${offset}`,
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
    rows.forEach((row) => {
      const raw = (row as Record<string, unknown>)[column];
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

  if (allowedValues && allowedValues.length) {
    const allowed = new Set(allowedValues.map((v) => String(v)));
    result = result.filter((entry) => allowed.has(entry.value));
  }

  result.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });

  return result;
};
