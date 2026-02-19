import { useEffect, useMemo, useState, ReactNode } from "react";
import AppliedFilterBar from "./AppliedFilterBar";
import FilterChips, { AppliedFilters, FilterOption } from "./FilterChips";
import MessageBubble from "./MessageBubble";
import ResultTable from "./ResultTable";

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  richText?: ReactNode;
  result?: {
    sql: string;
    columns: string[];
    rows: Record<string, unknown>[];
    chartAllowed?: boolean;
    isDrill?: boolean;
    question?: string;
  };
};

type ChatState =
  | { status: "idle" }
  | { status: "needs_filter"; filterGroups: FilterOption[] }
  | {
      status: "ready";
      sql: string;
      columns: string[];
      rows: Record<string, unknown>[];
    };

type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  columns?: string[];
};

const formatDatasetName = (name: string) => {
  if (!name) return "";
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const cleaned = withoutExt
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return cleaned || withoutExt;
};

type ChatResponse =
  | {
      status: "needs_filter";
      filter_groups: FilterOption[];
    }
  | {
      status: "ready";
      sql: string;
      filter_groups?: FilterOption[];
      result: { rows: Record<string, unknown>[]; columns: string[] };
    };

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const withBase = (path: string) => {
  const trimmedBase = API_BASE.replace(/\/+$/, "");
  return path.startsWith("http") ? path : `${trimmedBase}${path}`;
};

type ChatWindowProps = {
  showSql?: boolean;
  authToken?: string | null;
  heightClass?: string;
};

const ChatWindow = ({
  showSql = false,
  authToken,
  heightClass = "h-[85vh] max-h-[85vh]",
}: ChatWindowProps) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState>({ status: "idle" });
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({});
  const [filterGroups, setFilterGroups] = useState<FilterOption[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [columnPrefsOpen, setColumnPrefsOpen] = useState(false);
  const [columnPrefsLoading, setColumnPrefsLoading] = useState(false);
  const [columnPrefsSaving, setColumnPrefsSaving] = useState(false);
  const [columnPrefs, setColumnPrefs] = useState<Record<string, Set<string>>>(
    {}
  );
  const [columnPrefsError, setColumnPrefsError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);
  const [pinnedQuestions, setPinnedQuestions] = useState<
    { id: string; question: string }[]
  >([]);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const gridCols = customizeOpen
    ? "lg:grid-cols-[minmax(0,1fr)_360px]"
    : "lg:grid-cols-1";

  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  );

  const authedFetch = (path: string, options?: RequestInit) => {
    const target = withBase(path);
    const headers = { ...(options?.headers || {}), ...authHeaders };
    return fetch(target, { ...options, headers });
  };

  const isChartAllowed = (cols: string[]): boolean => {
    if (!cols.length) return false;
    const dimensionCount = cols.filter((c) => !/count/i.test(c)).length;
    const measureCount = cols.length - dimensionCount;
    // Allow chart only when there is a single dimension and a single measure (e.g., dim + count)
    if (cols.length > 2) return false;
    if (dimensionCount > 1) return false;
    if (measureCount < 1) return false;
    return true;
  };

  const availableColumns = useMemo(() => {
    const source =
      state.status === "needs_filter" ? state.filterGroups : filterGroups;
    const cols = source.map((g) => g.column).filter(Boolean);
    return Array.from(new Set(cols));
  }, [state, filterGroups]);

  const suggestedQuestions = useMemo(() => {
    if (!availableColumns.length) {
      return {
        general: [] as string[],
        filters: [] as string[],
        singles: [] as string[],
        pairs: [] as string[],
        triples: [] as string[],
      };
    }

    const general: string[] = [];
    availableColumns.slice(0, 5).forEach((col) => {
      general.push(`Show distinct values of ${col}`);
      general.push(`Count rows where ${col} is not blank`);
    });

    const filters: string[] = [];
    for (let i = 0; i < availableColumns.length; i += 1) {
      for (let j = 0; j < availableColumns.length; j += 1) {
        if (i === j) continue;
        filters.push(
          `Show counts grouped by ${availableColumns[i]} where ${availableColumns[j]} = "<value>"`
        );
        if (filters.length >= 6) break;
      }
      if (filters.length >= 6) break;
    }

    const singles = availableColumns
      .slice(0, 8)
      .map((col) => `Show counts grouped by ${col}`);

    const pairs: string[] = [];
    for (let i = 0; i < availableColumns.length; i += 1) {
      for (let j = i + 1; j < availableColumns.length; j += 1) {
        pairs.push(
          `Show counts grouped by ${availableColumns[i]} and ${availableColumns[j]}`
        );
        if (pairs.length >= 8) break;
      }
      if (pairs.length >= 8) break;
    }

    const triples: string[] = [];
    for (let i = 0; i < availableColumns.length; i += 1) {
      for (let j = i + 1; j < availableColumns.length; j += 1) {
        for (let k = j + 1; k < availableColumns.length; k += 1) {
          triples.push(
            `Show counts grouped by ${availableColumns[i]}, ${availableColumns[j]}, and ${availableColumns[k]}`
          );
          if (triples.length >= 6) break;
        }
        if (triples.length >= 6) break;
      }
      if (triples.length >= 6) break;
    }

    return { general, filters, singles, pairs, triples };
  }, [availableColumns]);

  const exportChat = () => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const messageBlocks = messages.map((m, idx) => {
      const header = `<h2>Message ${idx + 1} - ${m.sender}</h2>`;
      const text = `<p>${escapeHtml(m.text)}</p>`;

      if (!m.result) return `${header}${text}`;

      const sqlBlock = showSql
        ? `<pre style="background:#f8fafc;border:1px solid #cbd5e1;padding:8px;border-radius:8px;">${escapeHtml(
            m.result.sql
          )}</pre>`
        : "";

      const columns = m.result.columns;
      const rows = m.result.rows || [];
      const tableHead = columns
        .map(
          (c) =>
            `<th style="border:1px solid #cbd5e1;padding:6px;">${escapeHtml(
              String(c)
            )}</th>`
        )
        .join("");
      const tableRows = rows
        .map((row) => {
          const cells = columns
            .map((c) => {
              const value = row[c];
              return `<td style="border:1px solid #cbd5e1;padding:6px;">${escapeHtml(
                value === null || value === undefined ? "" : String(value)
              )}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");

      const tableBlock = rows.length
        ? `<div><p style="margin:8px 0 4px 0;">Result data (${
            rows.length
          } rows)</p><table style="border-collapse:collapse;width:100%;font-size:12px;">${
            tableHead ? `<thead><tr>${tableHead}</tr></thead>` : ""
          }<tbody>${tableRows}</tbody></table></div>`
        : "<p>No rows returned.</p>";

      return `${header}${text}${sqlBlock}${tableBlock}`;
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Chat Export</title></head><body style="font-family:Arial, sans-serif; color:#0f172a;">${messageBlocks.join(
      "<hr style='margin:16px 0;border:0;border-top:1px solid #e2e8f0;'>"
    )}</body></html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-export-${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const appendMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const fetchDatasets = async () => {
    setDatasetsLoading(true);
    setStatusMessage(null);
    try {
      const res = await authedFetch("/api/datasets");
      if (!res.ok) {
        throw new Error(res.statusText || "Failed to load datasets");
      }
      const data: Dataset[] = await res.json();
      setDatasets(data);
      if (data.length && !selectedDatasetId) {
        setSelectedDatasetId(data[0].id);
      }
      if (!data.length) {
        setStatusMessage("Upload a dataset in Admin, then chat here.");
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Failed to load datasets"
      );
    } finally {
      setDatasetsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load column preferences for the selected dataset (per user)
  useEffect(() => {
    const loadPrefs = async () => {
      if (!selectedDatasetId) return;
      const datasetColumns =
        datasets.find((d) => d.id === selectedDatasetId)?.columns || [];

      // Apply default (all columns) if we don't have prefs yet
      if (datasetColumns.length) {
        setColumnPrefs((prev) => {
          if (prev[selectedDatasetId]) return prev;
          return {
            ...prev,
            [selectedDatasetId]: new Set(datasetColumns),
          };
        });
      }

      setColumnPrefsLoading(true);
      setColumnPrefsError(null);
      try {
        const res = await authedFetch(
          `/api/datasets/${encodeURIComponent(
            selectedDatasetId
          )}/column-preferences`
        );
        if (!res.ok) {
          throw new Error(
            res.statusText || "Failed to load column preferences"
          );
        }
        const data: { columns: string[]; selected: string[] } =
          await res.json();
        const allowed = data.columns || datasetColumns;
        const selected =
          data.selected && data.selected.length ? data.selected : allowed;
        setColumnPrefs((prev) => ({
          ...prev,
          [selectedDatasetId]: new Set(
            selected.filter((c) => allowed.includes(c))
          ),
        }));
      } catch (err) {
        console.warn("Failed to load column preferences", err);
        setColumnPrefsError(
          err instanceof Error
            ? err.message
            : "Failed to load column preferences"
        );
      } finally {
        setColumnPrefsLoading(false);
      }
    };

    loadPrefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId, datasets.map((d) => d.id).join(",")]);

  // Load pinned questions for the selected dataset
  useEffect(() => {
    const loadPins = async () => {
      if (!selectedDatasetId) {
        setPinnedQuestions([]);
        return;
      }
      try {
        const res = await authedFetch(
          `/api/pins?dataset_id=${encodeURIComponent(selectedDatasetId)}`
        );
        if (!res.ok) throw new Error(res.statusText || "Failed to load pins");
        const data = await res.json();
        setPinnedQuestions(
          (data?.pins || []).map((p: any) => ({
            id: p.id,
            question: p.question,
          }))
        );
      } catch (err) {
        console.warn("Failed to load pinned questions", err);
        setPinnedQuestions([]);
      }
    };
    loadPins();
  }, [selectedDatasetId]);

  // Load initial filters when a dataset is selected and no question yet
  useEffect(() => {
    const loadInitialFilters = async () => {
      if (!selectedDatasetId) return;
      if (filterGroups.length) return;
      if (state.status !== "idle") return;
      try {
        const res = await authedFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: selectedDatasetId,
            question: "",
            applied_filters: [],
          }),
        });
        if (!res.ok) return;
        const data: ChatResponse = await res.json();
        if (data.status === "needs_filter" && data.filter_groups?.length) {
          setFilterGroups(data.filter_groups);
          setState({
            status: "needs_filter",
            filterGroups: data.filter_groups,
          });
        }
      } catch (err) {
        // Silently ignore to avoid blocking UI on first load
        console.warn("Failed to load initial filters", err);
      }
    };
    loadInitialFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetId, filterGroups.length, state.status]);

  const buildFiltersPayload = (filters?: AppliedFilters) => {
    if (!filters) return [];
    return Object.entries(filters)
      .map(([column, set]) => ({ column, values: Array.from(set) }))
      .filter((f) => f.values.length);
  };

  const buildDrillFilters = (
    row: Record<string, unknown>,
    cols: string[],
    allowed: FilterOption[]
  ): AppliedFilters => {
    const canon = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .trim();
    const allowedByCanon = new Map<string, string>();
    if (allowed.length) {
      allowed.forEach((f) => allowedByCanon.set(canon(f.column), f.column));
    }

    const columnsByCanon = new Map<string, string>();
    cols.forEach((col) => {
      if (/count/i.test(col)) return;
      columnsByCanon.set(canon(col), col);
    });
    const next: AppliedFilters = {};
    cols.forEach((col) => {
      if (/count/i.test(col)) return;
      let targetCol = col;
      const colCanon = canon(col);
      // Map ageing bucket drill to the actual ageing column name in the dataset
      if (colCanon === "ageing_bucket") {
        const ageingOption = allowedByCanon.get("ageing_as_on_today");
        if (ageingOption) {
          targetCol = ageingOption;
        }
      }
      const targetCanon = canon(targetCol);
      // Map ageing bucket drill to underlying ageing column with range encoding
      const canonicalColumn =
        allowedByCanon.get(targetCanon) || columnsByCanon.get(targetCanon);
      if (!canonicalColumn) return;
      targetCol = canonicalColumn;
      const value = row[col];
      const trimmed =
        value === null || value === undefined ? "" : String(value).trim();
      if (!trimmed) return;
      const storeVal =
        colCanon === "ageing_bucket" && targetCanon === "ageing_as_on_today"
          ? `range:${trimmed}`
          : trimmed;
      const existing = next[targetCol] ?? new Set<string>();
      existing.add(storeVal);
      next[targetCol] = existing;
    });
    return next;
  };

  const buildSkillFiltersFromQuestion = (
    questionText: string,
    allowed: FilterOption[]
  ): AppliedFilters => {
    const lower = questionText.toLowerCase();
    const tokens: string[] = [];
    if (lower.includes("aws")) tokens.push("aws");
    if (lower.includes("devops")) tokens.push("devops");
    if (!tokens.length) return {};

    const skillCol = allowed.find(
      (g) => g.column.toLowerCase() === "skill_set"
    )?.column;
    if (!skillCol) return {};

    return { [skillCol]: new Set(tokens) };
  };

  const buildStatusFiltersFromQuestion = (
    questionText: string,
    allowed: FilterOption[],
    cols: string[]
  ): AppliedFilters => {
    const lower = questionText.toLowerCase();
    const statusCol =
      allowed.find((g) => g.column.toLowerCase() === "status")?.column ||
      cols.find((c) => c.toLowerCase() === "status") ||
      "status"; // default to status even if not in columns list

    let statusValue: string | null = null;
    if (
      lower.includes("open position") ||
      lower.includes("open demand") ||
      lower.includes("open demands") ||
      lower.includes("in-progress") ||
      lower.includes("in progress") ||
      /\bopen\b/.test(lower)
    ) {
      statusValue = "In-Progress";
    }
    if (lower.includes("halted")) statusValue = "Halted";
    if (!statusValue) return {};

    return { [statusCol]: new Set([statusValue]) };
  };

  const buildEqualityFiltersFromQuestion = (
    questionText: string,
    allowed: FilterOption[]
  ): AppliedFilters => {
    let preserveRaw = false;
    let rawCol: string | undefined;
    let rawVals: string | undefined;

    const matchEq = questionText.match(/([A-Za-z0-9 _.-]+)\s*=\s*([^?]+)/);
    if (matchEq) {
      rawCol = matchEq[1]?.trim();
      rawVals = matchEq[2]?.trim();
    }

    if (!rawCol || !rawVals) {
      const matchIsQuoted = questionText.match(
        /where\s+([A-Za-z0-9 _.-]+)\s+(?:is|equals?|equal to)\s+["']([^"']+)["']/i
      );
      if (matchIsQuoted) {
        rawCol = matchIsQuoted[1]?.trim();
        rawVals = matchIsQuoted[2]?.trim();
        preserveRaw = true;
      }
    }

    if (!rawCol || !rawVals) return {};

    const norm = (s: string) =>
      s
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .toLowerCase();
    const colLower = norm(rawCol);
    let column =
      allowed.find((g) => norm(g.column) === colLower)?.column ||
      allowed.find((g) => norm(g.column).includes(colLower))?.column;

    const tokens = preserveRaw
      ? [rawVals]
      : rawVals
          .split(/[\/,&]|\bor\b|\band\b/i)
          .map((v) => v.trim())
          .filter(Boolean);
    if (!tokens.length) return {};

    // If direct column match fails, try matching by value tokens
    if (!column) {
      const tokenSet = new Set(tokens.map((t) => norm(t)));
      const byValue = allowed.find((g) =>
        (g.values || []).some((val) => tokenSet.has(norm(String(val))))
      );
      if (byValue) {
        column = byValue.column;
      }
    }

    if (!column) return {};

    return { [column]: new Set(tokens) };
  };

  const formatFilters = (filters?: AppliedFilters) => {
    if (!filters) return "";
    const parts = Object.entries(filters)
      .filter(([, set]) => set.size)
      .map(([col, set]) => `${col}=${Array.from(set).join(",")}`);
    return parts.length ? ` [filters: ${parts.join("; ")}]` : "";
  };

  const runChat = async (newQuestion?: string, filters?: AppliedFilters) => {
    if (!selectedDatasetId) {
      setStatusMessage("Select a dataset to chat with.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    const question = newQuestion ?? (lastQuestion || input);
    if (question) setLastQuestion(question);
    const displayQuestion = `${question}${formatFilters(filters)}`.trim();

    appendMessage({
      id: crypto.randomUUID(),
      sender: "user",
      text: displayQuestion,
    });

    try {
      const res = await authedFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          question,
          applied_filters: buildFiltersPayload(filters),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Chat failed");
      }

      const data: ChatResponse = await res.json();

      if (data.status === "needs_filter") {
        if (data.filter_groups && data.filter_groups.length) {
          setFilterGroups(data.filter_groups);
        }
        setState({ status: "needs_filter", filterGroups: data.filter_groups });
        appendMessage({
          id: crypto.randomUUID(),
          sender: "assistant",
          text: "I need more detail. Pick filters to narrow the data.",
        });
      } else {
        if (data.filter_groups && data.filter_groups.length) {
          setFilterGroups(data.filter_groups);
        }
        const rowCount = data.result?.rows?.length ?? 0;
        const chartAllowed = isChartAllowed(data.result.columns || []);
        setState({
          status: "ready",
          sql: data.sql,
          columns: data.result.columns,
          rows: data.result.rows,
        });
        appendMessage({
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `Here are the results (${rowCount} rows).`,
          result: {
            sql: data.sql,
            columns: data.result.columns,
            rows: data.result.rows,
            chartAllowed,
            isDrill: false,
            question: displayQuestion,
          },
        });
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setAppliedFilters({});
    setLastQuestion(input.trim());
    runChat(input.trim(), {});
    setInput("");
  };

  const handleFiltersChange = (next: AppliedFilters) => {
    setAppliedFilters(next);
    const question = lastQuestion || input || "";
    runChat(question, next);
  };

  const removeFilter = (column: string, value?: string) => {
    setAppliedFilters((prev) => {
      const next = { ...prev };
      if (!next[column]) return prev;
      if (value) {
        next[column].delete(value);
      } else {
        delete next[column];
      }
      if (value && next[column] && next[column].size === 0) delete next[column];

      const question = lastQuestion || input || "";
      runChat(question, next);
      return { ...next };
    });
  };

  const pinQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!selectedDatasetId) {
      setStatusMessage("Select a dataset before pinning.");
      return;
    }
    if (pinnedQuestions.some((p) => p.question === trimmed)) return;
    try {
      const res = await authedFetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset_id: selectedDatasetId,
          question: trimmed,
        }),
      });
      if (!res.ok) throw new Error(res.statusText || "Failed to pin question");
      const data = await res.json();
      const pin = data?.pin;
      if (pin?.question && pin?.id) {
        setPinnedQuestions((prev) => {
          if (prev.some((p) => p.question === pin.question)) return prev;
          return [{ id: pin.id, question: pin.question }, ...prev];
        });
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Failed to pin question"
      );
    }
  };

  const unpinQuestion = async (pinId: string) => {
    if (!pinId) return;
    try {
      const res = await authedFetch(`/api/pins/${encodeURIComponent(pinId)}`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error(res.statusText || "Failed to unpin question");
      setPinnedQuestions((prev) => prev.filter((p) => p.id !== pinId));
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Failed to unpin question"
      );
    }
  };

  const getPinIdForQuestion = (question: string) =>
    pinnedQuestions.find((p) => p.question === question)?.id || "";

  const askPinnedQuestion = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setAppliedFilters({});
    setInput("");
    setShowHelp(false);
    runChat(trimmed, {});
  };

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedDatasetName = selectedDataset
    ? formatDatasetName(
        selectedDataset.original_file_name || selectedDataset.table_name
      )
    : "";

  const selectedColumnsForDataset = useMemo(() => {
    const cols = selectedDataset?.columns || [];
    const saved = columnPrefs[selectedDatasetId];
    if (saved) return Array.from(saved);
    return cols;
  }, [selectedDataset, selectedDatasetId, columnPrefs]);

  const toggleColumnPreference = (col: string) => {
    if (!selectedDatasetId) return;
    setColumnPrefs((prev) => {
      const current = new Set(
        prev[selectedDatasetId] || selectedDataset?.columns || []
      );
      if (current.has(col)) current.delete(col);
      else current.add(col);
      return { ...prev, [selectedDatasetId]: current };
    });
  };

  const setAllColumnPreferences = (checked: boolean) => {
    if (!selectedDatasetId || !selectedDataset?.columns?.length) return;
    setColumnPrefs((prev) => ({
      ...prev,
      [selectedDatasetId]: checked
        ? new Set(selectedDataset.columns)
        : new Set<string>(),
    }));
  };

  const saveColumnPreferences = async () => {
    if (!selectedDatasetId) return;
    const columnsToSave = selectedColumnsForDataset;
    if (!columnsToSave.length) {
      setColumnPrefsError("Select at least one column");
      return;
    }
    setColumnPrefsSaving(true);
    setColumnPrefsError(null);
    try {
      const res = await authedFetch(
        `/api/datasets/${encodeURIComponent(
          selectedDatasetId
        )}/column-preferences`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columns: columnsToSave }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.detail || res.statusText || "Failed to save preferences"
        );
      }
      const data: { selected: string[] } = await res.json();
      setColumnPrefs((prev) => ({
        ...prev,
        [selectedDatasetId]: new Set(
          (data.selected || columnsToSave).filter((c) =>
            (selectedDataset?.columns || []).includes(c)
          )
        ),
      }));
      setStatusMessage("Column preferences saved");
      setColumnPrefsOpen(false);
    } catch (err) {
      setColumnPrefsError(
        err instanceof Error ? err.message : "Failed to save preferences"
      );
    } finally {
      setColumnPrefsSaving(false);
    }
  };
  useEffect(() => {
    if (!messages.length) {
      const trackerName = selectedDatasetName || "your tracker";
      setMessages([
        {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: `Hello, Welcome!\nGot a question on the ${trackerName}? Just type it below, and I’ll assist you right away.`,
          richText: (
            <span className="whitespace-pre-line">
              <span className="font-semibold">Hello, Welcome!</span>
              {"\n"}
              {`Got a question on the ${trackerName}? Just type it below, and I’ll assist you right away.`}
            </span>
          ),
        },
      ]);
    }
    // We intentionally do not add messages to deps to avoid re-seeding after first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetName]);
  const hasUserMessage = messages.some((m) => m.sender === "user");

  const runDrill = async (row: Record<string, unknown>, cols: string[]) => {
    if (!selectedDatasetId) {
      setStatusMessage("Select a dataset to drill.");
      return;
    }

    let drillFilters = buildDrillFilters(row, cols, filterGroups || []);
    if (!Object.keys(drillFilters).length) {
      const skillGuess = buildSkillFiltersFromQuestion(
        lastQuestion || input || "",
        filterGroups || []
      );
      if (Object.keys(skillGuess).length) {
        drillFilters = skillGuess;
      }
    }

    if (!Object.keys(drillFilters).length) {
      const equalityGuess = buildEqualityFiltersFromQuestion(
        lastQuestion || input || "",
        filterGroups || []
      );
      if (Object.keys(equalityGuess).length) {
        drillFilters = equalityGuess;
      }
    }

    const statusGuess = buildStatusFiltersFromQuestion(
      lastQuestion || input || "",
      filterGroups || [],
      cols
    );
    if (Object.keys(statusGuess).length) {
      drillFilters = { ...drillFilters, ...statusGuess };
    }

    // Enforce status only when the current filter groups include it (avoid re-adding on fresh bucket drills)
    const statusFilter = (filterGroups || []).find(
      (g) =>
        g.column.toLowerCase() === "status" &&
        g.values?.some((v) => String(v).toLowerCase().includes("in-progress"))
    );
    if (statusFilter && !drillFilters[statusFilter.column]) {
      const values = statusFilter.values
        .filter((v) => String(v).trim())
        .map((v) => String(v).trim());
      if (values.length) {
        drillFilters = {
          ...drillFilters,
          [statusFilter.column]: new Set(values),
        };
      }
    }

    // Always carry over user-applied filters so drill respects current chips
    if (
      Object.keys(appliedFilters).length ||
      Object.keys(drillFilters).length
    ) {
      const bucketOverrideCols = new Set<string>();
      const ageingSet = drillFilters["ageing_as_on_today"];
      if (
        ageingSet &&
        Array.from(ageingSet).some((v) => String(v).startsWith("range:"))
      ) {
        bucketOverrideCols.add("ageing_as_on_today");
      }
      // If we just derived status from current filters, avoid re-appending prior status chips
      if (statusFilter) {
        bucketOverrideCols.add(statusFilter.column.toLowerCase());
      }
      const merged: AppliedFilters = { ...drillFilters };
      Object.entries(appliedFilters).forEach(([col, set]) => {
        if (bucketOverrideCols.has(col.toLowerCase())) {
          // Do not append previous ageing ranges when drilling a fresh bucket selection
          return;
        }
        if (!merged[col]) {
          merged[col] = new Set(set);
        } else {
          merged[col] = new Set([...(merged[col] || []), ...set]);
        }
      });
      drillFilters = merged;
    }

    if (!Object.keys(drillFilters).length) {
      setStatusMessage("No drillable columns in this result.");
      return;
    }
    const payload = {
      dataset_id: selectedDatasetId,
      filters: buildFiltersPayload(drillFilters),
      limit: 500,
    };

    setLoading(true);
    setStatusMessage(null);
    const summaryParts = Object.entries(drillFilters).map(
      ([col, set]) => `${col}=${Array.from(set).join(",")}`
    );

    appendMessage({
      id: crypto.randomUUID(),
      sender: "assistant",
      text: summaryParts.length
        ? `Drilling into rows for ${summaryParts.join("; ")}`
        : "Drilling into rows",
    });

    try {
      const res = await authedFetch("/api/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Drill failed");
      }

      const data: ChatResponse = await res.json();
      if (data.status !== "ready") {
        throw new Error("Drill did not return rows");
      }

      // Update available filters based on the drill result set so subsequent drills use result-based values
      if (data.filter_groups && data.filter_groups.length) {
        setFilterGroups(data.filter_groups);
      }
      setState({
        status: "ready",
        sql: data.sql,
        columns: data.result.columns,
        rows: data.result.rows,
      });

      appendMessage({
        id: crypto.randomUUID(),
        sender: "assistant",
        text: `Drill results (${data.result.rows?.length ?? 0} rows)`,
        result: {
          sql: data.sql,
          columns: data.result.columns,
          rows: data.result.rows,
          chartAllowed: false,
          isDrill: true,
          question: summaryParts.length
            ? `Drill: ${summaryParts.join("; ")}`
            : "Drill results",
        },
      });
    } catch (err) {
      setStatusMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative grid ${heightClass} gap-6 ${gridCols}`}>
      <button
        type="button"
        aria-label={
          customizeOpen ? "Collapse customize panel" : "Expand customize panel"
        }
        aria-expanded={customizeOpen}
        onClick={() => setCustomizeOpen((prev) => !prev)}
        className="absolute right-4 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:-translate-y-0.5 hover:border-purple-300 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <span
          className={`text-lg transition-transform ${
            customizeOpen ? "rotate-180" : "rotate-0"
          }`}
        >
          ⚙
        </span>
      </button>
      <div className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-sky-200/80 bg-white/80 p-6 shadow-lg shadow-sky-100/80 backdrop-blur dark:border-sky-500/50 dark:bg-slate-800/60 dark:shadow-sky-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3 pr-16 lg:pr-24 dark:border-sky-900/40">
          <div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Chat about
            </p>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {selectedDatasetName || "Pick a dataset"}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <button
              type="button"
              onClick={exportChat}
              className="rounded-lg border border-purple-500 bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
            >
              <span aria-hidden>⬇️</span>
              Export chat
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((prev) => !prev)}
              className="rounded-lg border border-purple-500 bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
              title="How to pick and use a dataset"
            >
              ?
            </button>
            <select
              className="rounded-lg border border-purple-500 bg-white px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
            >
              <option value="" disabled>
                {datasetsLoading ? "Loading…" : "Select dataset"}
              </option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {formatDatasetName(ds.original_file_name || ds.table_name)}
                </option>
              ))}
            </select>
            {selectedDataset && (
              <button
                type="button"
                onClick={() => setColumnPrefsOpen(true)}
                className="rounded-lg border border-purple-500 bg-white px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
              >
                Column prefs
              </button>
            )}
          </div>
        </div>

        {columnPrefsOpen && selectedDataset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Column preferences
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {formatDatasetName(
                      selectedDataset.original_file_name ||
                        selectedDataset.table_name
                    )}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setColumnPrefsOpen(false)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Close
                </button>
              </div>

              {columnPrefsError && (
                <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
                  {columnPrefsError}
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                {!columnPrefsLoading && selectedDataset.columns?.length && (
                  <div className="mb-3 flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-100">
                      <input
                        type="checkbox"
                        checked={
                          selectedColumnsForDataset.length ===
                          selectedDataset.columns.length
                        }
                        onChange={(e) =>
                          setAllColumnPreferences(e.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      Toggle all
                    </label>
                    <span className="text-slate-500 dark:text-slate-400">
                      {selectedColumnsForDataset.length}/
                      {selectedDataset.columns.length} selected
                    </span>
                  </div>
                )}
                {columnPrefsLoading && (
                  <p className="text-slate-500 dark:text-slate-400">
                    Loading columns…
                  </p>
                )}
                {!columnPrefsLoading && !selectedDataset.columns?.length && (
                  <p className="text-slate-500 dark:text-slate-400">
                    No columns found.
                  </p>
                )}
                {!columnPrefsLoading && selectedDataset.columns?.length && (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedDataset.columns.map((col) => {
                      const checked = selectedColumnsForDataset.includes(col);
                      const inputId = `col-pref-${
                        selectedDataset.id
                      }-${col.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
                      return (
                        <li key={col} className="flex items-center gap-2">
                          <input
                            id={inputId}
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumnPreference(col)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <label
                            htmlFor={inputId}
                            className="text-slate-700 dark:text-slate-100"
                          >
                            {col}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setColumnPrefsOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveColumnPreferences}
                  disabled={columnPrefsSaving}
                  className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
                >
                  {columnPrefsSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showHelp && (
          <div className="mb-2 max-h-56 overflow-y-auto rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-sky-800 dark:bg-slate-900 dark:text-slate-200">
            <p className="mb-2 font-semibold">Quick how-to</p>
            <p className="mb-2">
              Pick a dataset, then ask a question (e.g., “Open demands aging
              more than 30 days by location”). Use filters below the answers to
              narrow results; drill uses the filters you choose.
            </p>
            {Boolean(pinnedQuestions.length) && (
              <div className="mb-2 space-y-1">
                <p className="font-semibold">Pinned prompts</p>
                <ul className="list-disc space-y-1 pl-4">
                  {pinnedQuestions.map((q) => (
                    <li key={q.id} className="flex items-start gap-2">
                      <span className="flex-1">{q.question}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => askPinnedQuestion(q.question)}
                          className="rounded-md border border-purple-500 bg-white px-2 py-[2px] text-[11px] font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
                        >
                          Ask
                        </button>
                        <button
                          type="button"
                          onClick={() => unpinQuestion(q.id)}
                          className="rounded-md border border-purple-500 bg-white px-2 py-[2px] text-[11px] font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
                        >
                          Unpin
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Boolean(suggestedQuestions.general.length) && (
              <div className="mb-2 space-y-1">
                <p className="font-semibold">General ideas</p>
                <ul className="list-disc space-y-1 pl-4">
                  {suggestedQuestions.general.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {Boolean(suggestedQuestions.filters.length) && (
              <div className="mb-2 space-y-1">
                <p className="font-semibold">Filter + group examples</p>
                <ul className="list-disc space-y-1 pl-4">
                  {suggestedQuestions.filters.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {Boolean(suggestedQuestions.singles.length) && (
              <div className="mb-2 space-y-1">
                <p className="font-semibold">Single-column ideas</p>
                <ul className="list-disc space-y-1 pl-4">
                  {suggestedQuestions.singles.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {Boolean(suggestedQuestions.pairs.length) && (
              <div className="mb-2 space-y-1">
                <p className="font-semibold">Two-column group by</p>
                <ul className="list-disc space-y-1 pl-4">
                  {suggestedQuestions.pairs.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {Boolean(suggestedQuestions.triples.length) && (
              <div className="space-y-1">
                <p className="font-semibold">Multi-column group by</p>
                <ul className="list-disc space-y-1 pl-4">
                  {suggestedQuestions.triples.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            {!suggestedQuestions.singles.length && (
              <p className="mt-1 text-slate-500">
                Load a dataset to see suggested questions based on its columns.
              </p>
            )}
          </div>
        )}

        <div className="relative flex-1 space-y-3 overflow-y-auto pr-2">
          {!hasUserMessage && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="px-4 text-center text-2xl font-semibold text-slate-300 drop-shadow-sm dark:text-slate-600">
                Tracking at your fingertips
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <MessageBubble sender={msg.sender}>
                  {msg.richText ?? msg.text}
                </MessageBubble>
                {msg.sender === "user" &&
                  selectedDatasetId &&
                  (() => {
                    const existingPinId = getPinIdForQuestion(msg.text);
                    const isPinned = Boolean(existingPinId);
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          isPinned
                            ? unpinQuestion(existingPinId)
                            : pinQuestion(msg.text)
                        }
                        className={`rounded-lg border px-2 py-1 text-[11px] font-semibold shadow-sm focus:outline-none focus:ring-2 disabled:opacity-50 ${
                          isPinned
                            ? "border-purple-600 bg-purple-50 text-purple-800 hover:border-purple-700 hover:text-purple-900 focus:border-purple-700 focus:ring-purple-200 dark:border-purple-300 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-200"
                            : "border-purple-500 bg-white text-purple-700 hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:ring-purple-200 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
                        }`}
                      >
                        {isPinned ? "Unpin" : "Pin"}
                      </button>
                    );
                  })()}
              </div>
              {msg.result && (
                <div className="ml-6 mr-6 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                  {showSql && (
                    <details open>
                      <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-300">
                        SQL
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">
                        {msg.result.sql}
                      </pre>
                    </details>
                  )}
                  <div className="mt-3">
                    <ResultTable
                      columns={msg.result.columns}
                      rows={msg.result.rows}
                      question={msg.result.question}
                      onDrillDown={
                        msg.result.isDrill
                          ? undefined
                          : (row, cols) => runDrill(row, cols)
                      }
                      showChartToggle={
                        msg.result.isDrill
                          ? false
                          : msg.result.chartAllowed !== false
                      }
                      showCsvDownload={true}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <MessageBubble sender="assistant">Thinking…</MessageBubble>
          )}
          {statusMessage && (
            <MessageBubble sender="assistant">{statusMessage}</MessageBubble>
          )}
        </div>

        <div className="mt-auto flex items-center gap-3 pt-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your data"
            className="flex-1 max-w-4xl rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-slate-700"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-lg border border-purple-500 bg-white px-4 py-2 text-sm font-semibold text-purple-700 shadow-sm hover:border-purple-600 hover:text-purple-800 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-50 dark:border-purple-400/80 dark:bg-slate-900 dark:text-purple-100 dark:hover:border-purple-300 dark:hover:text-purple-50"
            disabled={loading}
          >
            Send
          </button>
        </div>
      </div>

      {customizeOpen && (
        <div className="flex h-full flex-col gap-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl shadow-purple-100/70 dark:border-slate-800/80 dark:bg-slate-900/80 dark:shadow-slate-900/60">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Customize
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Filters & View
                </h3>
              </div>
            </div>
            <div className="mb-4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
            <FilterChips
              groups={
                state.status === "needs_filter"
                  ? state.filterGroups
                  : filterGroups
              }
              applied={appliedFilters}
              onChange={handleFiltersChange}
            />
          </div>

          <AppliedFilterBar applied={appliedFilters} onRemove={removeFilter} />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
