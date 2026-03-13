import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatWindow from "../ChatWindow";
import DashboardChartPreview, {
  DashboardChartConfig,
} from "./DashboardChartPreview";
import Banner from "./Banner";
import ReportModal from "./ReportModal";
import OpenDemandModal, { HclOnboardingRow } from "./OpenDemandModal";
import {
  DEFAULT_CUSTOMER_HIRING_MANAGERS,
  DEFAULT_CUSTOMER_LEADERS,
  DEFAULT_HCL_DELIVER_SPOCS,
  DEFAULT_HCL_LEADERS,
  DEFAULT_PORTFOLIOS,
} from "../../models/customerRequirementDefaults";

type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
};

export type ChatSectionProps = {
  authToken: string | null;
  authUserRole?: string | null;
  showSql?: boolean;
  hideChat?: boolean;
};

type SideFilters = {
  portfolios: string[];
  customerLeaders: string[];
  customerHiringManagers: string[];
  hclLeaders: string[];
  hclDeliverSpocs: string[];
  quarters: string[];
  dateFrom: string;
  dateTo: string;
};

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const SIDE_FILTER_FIELDS = [
  "portfolio",
  "customer_requirements.portfolio",
  "interviewed_candidate_details.portfolio",
  "customer_leader",
  "customer_leaders",
  "customer_requirements.customer_leader",
  "customer_requirements.customer_leaders",
  "customer_hiring_manager",
  "customer_requirements.customer_hiring_manager",
  "hcl_leader",
  "customer_requirements.hcl_leader",
  "hcl_deliver_spoc",
  "hcl_deliver_spocs",
  "customer_requirements.hcl_deliver_spoc",
  "customer_requirements.hcl_deliver_spocs",
  "customer_job_posting_date",
  "created_at",
  "job_posting_date",
  "job_date",
];

const ChatWithDashboard = ({
  authToken,
  authUserRole,
  showSql,
  hideChat = false,
}: ChatSectionProps) => {
  const navigate = useNavigate();
  const [sideFilters, setSideFilters] = useState<SideFilters>({
    portfolios: [],
    customerLeaders: [],
    customerHiringManagers: [],
    hclLeaders: [],
    hclDeliverSpocs: [],
    quarters: [],
    dateFrom: "",
    dateTo: "",
  });
  const [widgetOptions, setWidgetOptions] = useState<
    {
      id: string;
      title: string;
      widget_type?: string | null;
      config?: any;
      roles?: string[];
    }[]
  >([]);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>(["all"]);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<
    {
      widgetId: string;
      title: string;
      widgetType?: string | null;
      config?: any;
      columns: string[];
      displayColumns?: string[];
      rows: Record<string, unknown>[];
    }[]
  >([]);
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<string[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportColumns, setReportColumns] = useState<string[]>([]);
  const [reportRows, setReportRows] = useState<Record<string, unknown>[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(
    null
  );
  const [openDemandsOpen, setOpenDemandsOpen] = useState(false);
  const [openDemandsRows, setOpenDemandsRows] = useState<HclOnboardingRow[]>(
    []
  );
  const [openDemandsLoading, setOpenDemandsLoading] = useState(false);
  const [openDemandsError, setOpenDemandsError] = useState<string | null>(null);
  const [openDemandsEditing, setOpenDemandsEditing] = useState<string | null>(
    null
  );
  const [openDemandsDraft, setOpenDemandsDraft] =
    useState<HclOnboardingRow | null>(null);
  const [openDemandsSaving, setOpenDemandsSaving] = useState(false);
  const [portfolioOptions, setPortfolioOptions] =
    useState<string[]>(DEFAULT_PORTFOLIOS);
  const [customerLeaderOptions, setCustomerLeaderOptions] = useState<string[]>(
    DEFAULT_CUSTOMER_LEADERS
  );
  const [customerHiringManagerOptions, setCustomerHiringManagerOptions] =
    useState<string[]>(DEFAULT_CUSTOMER_HIRING_MANAGERS);
  const [hclLeaderOptions, setHclLeaderOptions] =
    useState<string[]>(DEFAULT_HCL_LEADERS);
  const [hclDeliverSpocOptions, setHclDeliverSpocOptions] = useState<string[]>(
    DEFAULT_HCL_DELIVER_SPOCS
  );

  useEffect(() => {
    const loadDashboards = async () => {
      if (!authToken) {
        setDashboards([]);
        setSelectedDashboardId(null);
        return;
      }
      setDashboardsLoading(true);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(`${apiBase}/api/admin/dashboards`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load dashboards"
          );
        }
        const data = await res.json();
        const list = Array.isArray(data?.dashboards) ? data.dashboards : [];
        setDashboards(list);
        if (!list.length) {
          setSelectedDashboardId(null);
        } else {
          const stillValid = list.some((d) => d.id === selectedDashboardId);
          if (!stillValid) setSelectedDashboardId(list[0].id);
        }
      } catch (err) {
        setWidgetError(err instanceof Error ? err.message : String(err));
      } finally {
        setDashboardsLoading(false);
      }
    };

    loadDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!dashboards.length) {
      setSelectedDashboardId(null);
      return;
    }
    if (
      selectedDashboardId &&
      dashboards.some((d) => d.id === selectedDashboardId)
    ) {
      return;
    }
    setSelectedDashboardId(dashboards[0].id);
  }, [dashboards, selectedDashboardId]);

  useEffect(() => {
    if (!openDemandsOpen) return;
    const controller = new AbortController();
    const load = async () => {
      if (!authToken) {
        setOpenDemandsRows([]);
        setOpenDemandsError("You must be signed in to load demands.");
        return;
      }
      setOpenDemandsLoading(true);
      setOpenDemandsError(null);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(
          `${apiBase}/api/hcl-onboarding?status=InProgress`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load demands"
          );
        }
        const data = await res.json();
        const items: HclOnboardingRow[] = Array.isArray(data?.items)
          ? data.items
          : [];
        const normalized = items.map((row) => ({
          sap_id: row.sap_id || "",
          unique_job_posting_id: row.unique_job_posting_id || "",
          demand_id: row.demand_id || "",
          candidate_contact: row.candidate_contact || "",
          candidate_email: row.candidate_email || "",
          hcl_onboarding_status: row.hcl_onboarding_status || "",
          hire_loss_reason: row.hire_loss_reason || "",
          onboarded_date: row.onboarded_date
            ? String(row.onboarded_date).slice(0, 10)
            : "",
          employee_name: row.employee_name || "",
          employee_hcl_email: row.employee_hcl_email || "",
        }));
        setOpenDemandsRows(normalized);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setOpenDemandsError(err instanceof Error ? err.message : String(err));
      } finally {
        setOpenDemandsLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [authToken, openDemandsOpen]);

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(
          `${apiBase}/api/customer-requirements/defaults`,
          {
            headers: authToken
              ? { Authorization: `Bearer ${authToken}` }
              : undefined,
          }
        );
        if (!res.ok) {
          setPortfolioOptions(DEFAULT_PORTFOLIOS);
          setCustomerLeaderOptions(DEFAULT_CUSTOMER_LEADERS);
          setCustomerHiringManagerOptions(DEFAULT_CUSTOMER_HIRING_MANAGERS);
          setHclLeaderOptions(DEFAULT_HCL_LEADERS);
          setHclDeliverSpocOptions(DEFAULT_HCL_DELIVER_SPOCS);
          return;
        }
        const data = await res.json();
        const mergedPortfolios = Array.isArray(data?.portfolios)
          ? Array.from(new Set([...DEFAULT_PORTFOLIOS, ...data.portfolios]))
          : DEFAULT_PORTFOLIOS;
        const mergedCustomerLeaders = Array.isArray(data?.customer_leaders)
          ? Array.from(
              new Set([...DEFAULT_CUSTOMER_LEADERS, ...data.customer_leaders])
            )
          : DEFAULT_CUSTOMER_LEADERS;
        const mergedCustomerHiringManagers = Array.isArray(
          data?.customer_hiring_managers
        )
          ? Array.from(
              new Set([
                ...DEFAULT_CUSTOMER_HIRING_MANAGERS,
                ...data.customer_hiring_managers,
              ])
            )
          : DEFAULT_CUSTOMER_HIRING_MANAGERS;
        const mergedHclLeaders = Array.isArray(data?.hcl_leaders)
          ? Array.from(new Set([...DEFAULT_HCL_LEADERS, ...data.hcl_leaders]))
          : DEFAULT_HCL_LEADERS;
        const mergedHclDeliverSpocs = Array.isArray(data?.hcl_deliver_spocs)
          ? Array.from(
              new Set([...DEFAULT_HCL_DELIVER_SPOCS, ...data.hcl_deliver_spocs])
            )
          : DEFAULT_HCL_DELIVER_SPOCS;
        setPortfolioOptions(mergedPortfolios);
        setCustomerLeaderOptions(mergedCustomerLeaders);
        setCustomerHiringManagerOptions(mergedCustomerHiringManagers);
        setHclLeaderOptions(mergedHclLeaders);
        setHclDeliverSpocOptions(mergedHclDeliverSpocs);
      } catch (err) {
        console.error("Failed to load dashboard defaults", err);
        setPortfolioOptions(DEFAULT_PORTFOLIOS);
        setCustomerLeaderOptions(DEFAULT_CUSTOMER_LEADERS);
        setCustomerHiringManagerOptions(DEFAULT_CUSTOMER_HIRING_MANAGERS);
        setHclLeaderOptions(DEFAULT_HCL_LEADERS);
        setHclDeliverSpocOptions(DEFAULT_HCL_DELIVER_SPOCS);
      }
    };

    loadDefaults();
  }, [authToken]);

  useEffect(() => {
    const load = async () => {
      if (!authToken || !selectedDashboardId) {
        setWidgetOptions([]);
        setSelectedWidgetIds(["all"]);
        return;
      }
      setWidgetLoading(true);
      setWidgetError(null);
      try {
        const apiBase =
          import.meta.env.VITE_API_BASE || "http://localhost:8000";
        const res = await fetch(
          `${apiBase}/api/admin/dashboard-config?dashboard_id=${encodeURIComponent(selectedDashboardId)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` },
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load widgets"
          );
        }
        const data = await res.json();
        const widgets = Array.isArray(data?.widgets) ? data.widgets : [];
        const userRole = (authUserRole || "viewer").toLowerCase();
        const options = widgets
          .map(
            (w: {
              id?: string;
              title?: string;
              widget_type?: string;
              config?: any;
              roles?: string[];
            }) => ({
              id: String(w.id ?? ""),
              title: w.title || "Untitled",
              widget_type: w.widget_type,
              config: w.config,
              roles: Array.isArray(w.roles) ? w.roles : [],
            })
          )
          .filter((w) => w.id);

        const scoped = options.filter((w) => {
          const roles = Array.isArray(w.roles) ? w.roles : [];
          if (!roles.length) return userRole === "admin"; // fallback: only admins see unscoped widgets
          return roles.includes(userRole as string);
        });

        setWidgetOptions(scoped);
        setSelectedWidgetIds(["all"]);
        setCollapsedWidgetIds([]);
      } catch (err) {
        setWidgetError(err instanceof Error ? err.message : String(err));
      } finally {
        setWidgetLoading(false);
      }
    };

    load();
  }, [authToken, authUserRole, selectedDashboardId]);

  const handleWidgetToggle = (id: string) => {
    if (id === "all") {
      setSelectedWidgetIds(["all"]);
      return;
    }

    setSelectedWidgetIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((v) => v !== id)
        : [...prev.filter((v) => v !== "all"), id];
      return next.length ? next : ["all"];
    });
  };

  const widgetSummary = selectedWidgetIds.includes("all")
    ? "All widgets"
    : `${selectedWidgetIds.length} selected`;

  const targetWidgets = useMemo(
    () =>
      selectedWidgetIds.includes("all")
        ? widgetOptions
        : widgetOptions.filter((w) => selectedWidgetIds.includes(w.id)),
    [selectedWidgetIds, widgetOptions]
  );

  const buildPreviewTable = (
    cfg: any,
    datasetCols: string[],
    rows: Record<string, unknown>[]
  ): {
    columns: string[];
    displayColumns: string[];
    rows: Record<string, unknown>[];
  } => {
    const formatHeader = (col: string) => {
      const noPrefix = col.includes(".") ? col.split(".").pop() || col : col;
      const spaced = noPrefix.replace(/[_\.]+/g, " ").trim();
      if (!spaced) return col;
      return spaced
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    };
    const groupBy = cfg.group_by || "";
    const groupValues: string[] = cfg.group_by_values || [];
    const filterBy = cfg.filter_by || "";
    const filterValues: string[] = cfg.filter_values || [];
    const isRangeAgg =
      (datasetCols || []).includes("range") &&
      (datasetCols || []).includes("count");
    const ageingFields = (cfg.filters || [])
      .filter(
        (f: any) => (f.op || f.operator || "").toLowerCase() === "ageing_range"
      )
      .map((f: any) => {
        const field = f.field || "";
        return field.includes(".") ? field : `${cfg.dataset_id || ""}.${field}`;
      });
    const baseColumns = cfg.fields?.length ? cfg.fields : datasetCols;
    const columns = (() => {
      if (isRangeAgg) {
        const cols = datasetCols || baseColumns || [];
        const drop = new Set(
          ageingFields.flatMap((c: string) => [c, c.split(".").slice(-1)[0]])
        );
        return cols.filter((c: string) => !drop.has(c));
      }
      const trimmed = (baseColumns || []).filter((c: string) => c);
      if (!trimmed.length) return datasetCols || [];
      const sampleRow = rows[0] || {};
      const hasAny = trimmed.some(
        (c: string) => c in sampleRow || c.split(".").slice(-1)[0] in sampleRow
      );
      return hasAny ? trimmed : datasetCols || trimmed;
    })();

    const normalize = (col: string) =>
      col.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const isAgeing = (col: string) => normalize(col) === "ageing_as_on_today";
    const isDateCol = (col: string) =>
      normalize(col) === "jp_posting_date_to_hcl";
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
      if (num >= 31 && num <= 60) return "31-60";
      if (num >= 61 && num <= 90) return "61-90";
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
      if (month === null || year === null || month < 0 || month > 11)
        return str;
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

    const toDayRangeLabel = (val: unknown) => {
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
    };

    const toLabelFor = (
      col: string,
      selectedValues: string[],
      val: unknown
    ) => {
      if (isAgeing(col)) return bucketAgeLabel(val);

      const hasQuarter = hasQuarterVal(selectedValues);
      const hasQuarterYear = hasQuarterValWithYear(selectedValues);
      const hasDayRanges = hasDayRangeVal(selectedValues);
      const quarterLabel = toQuarterLabel(val, false);
      const quarterLabelYear = toQuarterLabel(val, true);
      const dayLabel = toDayRangeLabel(val);

      if (isDateCol(col) || hasDayRanges || hasQuarter) {
        if (hasDayRanges && hasQuarter) {
          if (selectedValues.includes(dayLabel)) return dayLabel;
          if (hasQuarterYear && selectedValues.includes(quarterLabelYear))
            return quarterLabelYear;
          if (selectedValues.includes(quarterLabel)) return quarterLabel;
          if (hasQuarterYear) return quarterLabelYear;
          return dayLabel;
        }
        if (hasDayRanges) return dayLabel;
        if (hasQuarter) {
          if (hasQuarterYear) return quarterLabelYear;
          return quarterLabel;
        }
      }

      return val === null || val === undefined ? "(blank)" : String(val);
    };

    const formatWithAgeingContext = (
      col: string,
      selection: string[],
      rawVal: unknown
    ) => {
      const label = toLabelFor(col, selection, rawVal);
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

    const matchesSelection = (
      col: string,
      selectedValues: string[],
      rowVal: unknown
    ) => {
      if (!selectedValues.length) return true;
      const norm = (v: unknown) =>
        typeof v === "string"
          ? v.trim().toLowerCase()
          : String(v ?? "")
              .trim()
              .toLowerCase();
      if (isAgeing(col)) {
        const num = Number(rowVal);
        if (!Number.isFinite(num)) return false;
        return selectedValues.some((gv) => matchesAgeRange(num, gv));
      }
      if (isDateCol(col)) {
        const quarterLabel = toQuarterLabel(rowVal, false);
        const quarterLabelYear = toQuarterLabel(rowVal, true);
        const dayLabel = toDayRangeLabel(rowVal);
        const rawLabel =
          rowVal === null || rowVal === undefined ? "(blank)" : String(rowVal);
        return selectedValues.some((v) => {
          const nv = norm(v);
          return (
            nv === norm(quarterLabel) ||
            nv === norm(quarterLabelYear) ||
            nv === norm(dayLabel) ||
            nv === norm(rawLabel)
          );
        });
      }
      const label = toLabelFor(col, selectedValues, rowVal);
      return selectedValues.some((v) => norm(v) === norm(label));
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
        // Column not present in returned rows (likely filtered server-side on joined table)
        // so do not exclude client-side.
        return true;
      }
      const normalizedOp = normalizeOp(op);
      const rowLabel = toLabelFor(col, values, rowVal);
      const rowNorm = normalizeValue(rowLabel);
      const normVals = values
        .map((v) => normalizeValue(v))
        .filter((v) => v.length);

      if (!normVals.length) return true;

      if (normalizedOp === "ageing_range") {
        const asNumber = Number(rowVal);
        const fromNumber = Number.isFinite(asNumber) ? asNumber : null;
        const dt = new Date(String(rowVal));
        const fromDate = Number.isNaN(dt.getTime())
          ? null
          : Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
        const diffDays = fromNumber ?? fromDate;
        if (diffDays === null) return true;
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

    const activeFilters = (cfg.filters || [])
      .filter(
        (f: any) =>
          f.field && (Array.isArray(f.value) ? f.value.length : f.value)
      )
      .map((f: any) => {
        const col = f.field || "";
        const prefixed =
          f.table && !col.includes(".") ? `${f.table}.${col}` : col;
        const rawValues = Array.isArray(f.value) ? f.value : [f.value];
        const values = rawValues
          .map((v) => String(v))
          .filter((v) => v.trim().length);
        const op = normalizeOp(f.op || f.operator || "in");
        return { ...f, column: prefixed, values, op };
      })
      .filter((f: any) => (f.values || []).length);

    const ageingSelections = new Map<string, string[]>();
    activeFilters
      .filter((f: any) => f.op === "ageing_range" || f.op === "quarter")
      .forEach((f: any) => {
        if (f.column) {
          const vals = f.values || [];
          ageingSelections.set(f.column, vals);
          const suffix = f.column.includes(".")
            ? f.column.split(".").slice(-1)[0]
            : f.column;
          if (suffix) ageingSelections.set(suffix, vals);
        }
      });

    const rowsAfterFilter = isRangeAgg
      ? rows
      : rows.filter((row) => {
          const primaryMatches = filterBy
            ? matchesSelection(filterBy, filterValues, valueFor(row, filterBy))
            : true;
          if (!primaryMatches) return false;

          if (!activeFilters.length) return true;

          return activeFilters.every((f: any) =>
            matchesFilterOp(
              f.column || f.field || "",
              f.op,
              f.values,
              valueFor(row, f.column || f.field || "")
            )
          );
        });

    if (groupBy && !isRangeAgg) {
      const filteredRows = rowsAfterFilter.filter((row) =>
        matchesSelection(groupBy, groupValues, valueFor(row, groupBy))
      );

      const showGroupColumn = groupValues.length !== 1;
      const finalColumns = showGroupColumn
        ? Array.from(new Set([...columns, groupBy, "count"]))
        : Array.from(
            new Set([...columns.filter((c) => c !== groupBy), "count"])
          );

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
            const display = selection.length
              ? formatWithAgeingContext(c, selection, rawVal)
              : rawVal;
            return String(display ?? "");
          }),
        ];
        const key = keyParts.join("|");

        if (!grouped.has(key)) {
          const baseRow: Record<string, unknown> = {};
          columns.forEach((c) => {
            const selection = ageingSelections.get(c) || [];
            const rawVal = valueFor(row, c);
            baseRow[c] = selection.length
              ? formatWithAgeingContext(c, selection, rawVal)
              : rawVal;
          });
          if (showGroupColumn) {
            baseRow[groupBy] = groupLabel;
          }
          grouped.set(key, { count: 0, row: baseRow });
        }

        const entry = grouped.get(key)!;
        entry.count += 1;
      });

      const rowsOut = Array.from(grouped.values()).map(({ count, row }) => ({
        ...row,
        count,
      }));

      const displayColumns = finalColumns.map((c) => formatHeader(c));
      return { columns: finalColumns, displayColumns, rows: rowsOut };
    }

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
          return display === null || display === undefined
            ? ""
            : String(display);
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
      ? collapseRangeRows(rows)
      : rowsAfterFilter.slice(0, 50);

    const rowsOut = sourceRows.map((row) => {
      const out: Record<string, unknown> = {};
      columns.forEach((c) => {
        const selection = ageingSelections.get(c) || [];
        const rawVal = valueFor(row, c);
        out[c] = selection.length
          ? formatWithAgeingContext(c, selection, rawVal)
          : rawVal;
      });

      // Ensure date-difference charts have both date fields available to the preview renderer
      // even when those fields are not part of the displayed column list.
      if (cfg.y_axis_mode === "date_diff") {
        const startKey = cfg.y_start_date_field || cfg.y_field;
        const endKey = cfg.y_end_date_field;
        if (startKey) out[startKey] = valueFor(row, startKey);
        if (endKey) out[endKey] = valueFor(row, endKey);
      }

      // Keep side-filter fields on the row even if they are not displayed, so
      // client-side filters work for aggregated/date-diff charts.
      SIDE_FILTER_FIELDS.forEach((key) => {
        if (out[key] !== undefined) return;
        const val = valueFor(row, key);
        if (val !== undefined) out[key] = val;
      });
      return out;
    });
    const displayColumns = columns.map((c) => formatHeader(c));
    return { columns, displayColumns, rows: rowsOut };
  };

  const buildFilterQuery = (cfg: any) => {
    const filterBy = cfg.filter_by || "";
    const filterValues: string[] = cfg.filter_values || [];
    const groupBy = cfg.group_by || "";
    const groupValues: string[] = cfg.group_by_values || [];
    const filters: {
      table?: string;
      field?: string;
      op?: string;
      operator?: string;
      value?: string | string[];
    }[] = cfg.filters || [];
    const joinedTables: string[] = cfg.joined_tables || [];
    const fields: string[] = cfg.fields || [];
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const isDateBucket = normalize(filterBy || "") === "jp_posting_date_to_hcl";
    const quarterPattern = /^Q[1-4](?:\s+\d{4})?$/i;
    const isQuarterVals = filterValues.every((v) => quarterPattern.test(v));
    const isDayRangeVals = filterValues.every(
      (v) => /^\d+\s*-\s*\d+$/.test(v) || /^\d+\+$/.test(v)
    );
    const skipServerFilter =
      filterBy &&
      filterValues.length &&
      isDateBucket &&
      (isQuarterVals || isDayRangeVals);

    const params = new URLSearchParams();
    (fields || []).forEach((f) => params.append("select_fields", f));
    const joinSet = new Set((joinedTables || []).filter(Boolean));
    const baseTable = cfg.dataset_id || "";
    let targetFilterBy = filterBy;
    let targetValues = filterValues;

    if (
      !filterBy &&
      groupBy &&
      normalize(groupBy) === "jp_posting_date_to_hcl"
    ) {
      const isGroupQuarterVals =
        groupValues.length > 0 &&
        groupValues.every((v) => quarterPattern.test(v));
      if (isGroupQuarterVals) {
        targetFilterBy = groupBy;
        targetValues = groupValues.map((v) => {
          const parts = v.trim().split(/\s+/);
          const qpart = parts[0] || v;
          const year = parts[1];
          return year
            ? `quarter:${qpart.replace(/^Q/i, "Q")} ${year}`
            : `quarter:${qpart.replace(/^Q/i, "Q")}`;
        });
      }
    }

    if (targetFilterBy && !skipServerFilter && targetValues.length) {
      params.set("filter_by", targetFilterBy);
      targetValues.forEach((v) => params.append("filter_values", v));
    }

    filters
      .filter(
        (f) => f.field && (Array.isArray(f.value) ? f.value.length : f.value)
      )
      .forEach((f) => {
        const prefix = f.table ? `${f.table}.` : "";
        if (f.table && f.table !== baseTable) {
          joinSet.add(f.table);
        }
        const rawValues = Array.isArray(f.value) ? f.value : [f.value];
        const values = rawValues
          .map((v) => String(v))
          .filter((v) => v.trim().length);
        if (!values.length) return;
        const op = (f.op || f.operator || "in").toLowerCase();
        const payload = {
          field: `${prefix}${f.field}`,
          table: f.table,
          op,
          values,
        };
        params.append("filters", JSON.stringify(payload));
      });
    Array.from(joinSet)
      .filter(Boolean)
      .forEach((t) => params.append("joined_tables", t));
    const qs = params.toString();
    return qs ? `&${qs}` : "";
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadPreviews = async () => {
      if (!authToken || !targetWidgets.length) {
        setPreviewItems([]);
        return;
      }
      setPreviewLoading(true);
      setPreviewError(null);
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const results: {
        widgetId: string;
        title: string;
        widgetType?: string | null;
        config?: any;
        columns: string[];
        displayColumns?: string[];
        rows: Record<string, unknown>[];
      }[] = [];

      for (const widget of targetWidgets) {
        const cfg = widget.config || {};
        const datasetId = cfg.dataset_id;
        if (!datasetId) continue;
        try {
          const joined = new Set<string>(cfg.joined_tables || []);
          const collectPrefix = (val?: string) => {
            if (!val || !val.includes(".")) return;
            const prefix = val.split(".")[0];
            if (prefix && prefix !== datasetId) joined.add(prefix);
          };

          const addField = (val?: string) => {
            if (!val) return;
            collectPrefix(val);
            const prefixed = val.includes(".") ? val : `${datasetId}.${val}`;
            selectFields.add(prefixed);
          };

          const selectFields = new Set<string>();
          (cfg.fields || []).forEach(addField);
          addField(cfg.x_field);
          addField(cfg.y_field);
          addField(cfg.group_by);
          addField(cfg.filter_by);
          addField(cfg.y_start_date_field);
          addField(cfg.y_end_date_field);
          SIDE_FILTER_FIELDS.forEach(addField);
          (cfg.filters || []).forEach((f: any) => {
            addField(f.field);
            if (f.table && f.table !== datasetId) joined.add(f.table);
          });

          const filterQs = buildFilterQuery({
            ...cfg,
            joined_tables: Array.from(joined),
            select_fields: Array.from(selectFields),
          });
          const limit = cfg.group_by ? 2000 : 50;
          const res = await fetch(
            `${apiBase}/api/admin/datasets/${datasetId}/records?limit=${limit}${filterQs}`,
            {
              headers: { Authorization: `Bearer ${authToken}` },
              signal: controller.signal,
            }
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              body.detail || res.statusText || "Failed to load preview"
            );
          }
          const data = await res.json();
          const datasetCols: string[] = data?.columns || [];
          const rows: Record<string, unknown>[] = data?.rows || [];
          const {
            columns,
            displayColumns,
            rows: builtRows,
          } = buildPreviewTable(cfg, datasetCols, rows);
          results.push({
            widgetId: widget.id,
            title: widget.title,
            widgetType: widget.widget_type,
            config: cfg,
            columns,
            displayColumns,
            rows: builtRows,
          });
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      }

      setPreviewItems(results);
      setPreviewLoading(false);
    };

    loadPreviews();

    return () => {
      controller.abort();
    };
  }, [authToken, targetWidgets]);

  const toggleWidgetCollapse = (id: string) => {
    setCollapsedWidgetIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    if (!showReportModal) return;
    const controller = new AbortController();
    const loadReport = async () => {
      if (!authToken) {
        setReportColumns([]);
        setReportRows([]);
        return;
      }
      setReportLoading(true);
      setReportError(null);
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      try {
        const res = await fetch(`${apiBase}/api/customer-requirements/report`, {
          headers: { Authorization: `Bearer ${authToken}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.detail || res.statusText || "Failed to load report data"
          );
        }
        const data = await res.json();
        const cols: string[] = Array.isArray(data?.columns) ? data.columns : [];
        const rows: Record<string, unknown>[] = Array.isArray(data?.rows)
          ? data.rows
          : [];
        setReportColumns(cols);
        setReportRows(rows);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setReportError(err instanceof Error ? err.message : String(err));
      }
      setReportLoading(false);
    };

    loadReport();

    return () => controller.abort();
  }, [authToken, showReportModal]);

  const layoutClass = hideChat
    ? "grid gap-4"
    : "grid gap-4 lg:grid-cols-[minmax(260px,26%),1fr]";

  const isHomeDashboard = selectedDashboardId === "home";
  const hasSideFilters = !isHomeDashboard;

  const canOpenReport = true;

  const handleEditRecord = (row: Record<string, unknown>) => {
    navigate("/job-posting", { state: { record: row } });
  };

  const handleDeletedRecord = (uniqueId: string) => {
    setReportRows((prev) =>
      prev.filter((row) => String(row.unique_job_posting_id ?? "") !== uniqueId)
    );
  };

  const handleOpenDemandsClose = () => {
    setOpenDemandsOpen(false);
    setOpenDemandsEditing(null);
    setOpenDemandsDraft(null);
  };

  const handleOpenDemandsEdit = (row: HclOnboardingRow) => {
    setOpenDemandsEditing(row.unique_job_posting_id);
    setOpenDemandsDraft({ ...row });
    setOpenDemandsError(null);
  };

  const handleOpenDemandsChangeDraft = (patch: Partial<HclOnboardingRow>) => {
    setOpenDemandsDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleOpenDemandsCancel = () => {
    setOpenDemandsEditing(null);
    setOpenDemandsDraft(null);
  };

  const handleOpenDemandsSave = async () => {
    if (!openDemandsDraft) return;
    setOpenDemandsSaving(true);
    try {
      if (!authToken) {
        throw new Error("Not authenticated");
      }
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const payload: HclOnboardingRow & { onboarded_date: string | null } = {
        ...openDemandsDraft,
        onboarded_date:
          openDemandsDraft.hcl_onboarding_status === "Onboarded" &&
          openDemandsDraft.onboarded_date
            ? openDemandsDraft.onboarded_date
            : null,
      };

      const res = await fetch(
        `${apiBase}/api/hcl-onboarding/${encodeURIComponent(
          openDemandsDraft.unique_job_posting_id
        )}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.detail || res.statusText || "Failed to update onboarding"
        );
      }
      setOpenDemandsRows((prev) =>
        prev.map((r) =>
          r.unique_job_posting_id === openDemandsDraft.unique_job_posting_id
            ? {
                ...openDemandsDraft,
                onboarded_date: payload.onboarded_date || "",
              }
            : r
        )
      );
      setOpenDemandsEditing(null);
      setOpenDemandsDraft(null);
    } catch (err) {
      setOpenDemandsError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpenDemandsSaving(false);
    }
  };

  const handleMultiSelect =
    (
      key: keyof Pick<
        SideFilters,
        | "portfolios"
        | "customerLeaders"
        | "customerHiringManagers"
        | "hclLeaders"
        | "hclDeliverSpocs"
        | "quarters"
      >
    ) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      const values = Array.from(event.target.selectedOptions).map(
        (opt) => opt.value
      );
      setSideFilters((prev) => ({ ...prev, [key]: values }));
    };

  const handleDateChange =
    (key: keyof Pick<SideFilters, "dateFrom" | "dateTo">) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setSideFilters((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleClearFilters = () => {
    setSideFilters({
      portfolios: [],
      customerLeaders: [],
      customerHiringManagers: [],
      hclLeaders: [],
      hclDeliverSpocs: [],
      quarters: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  const filteredPreviewItems = useMemo(() => {
    if (!hasSideFilters || !sideFilters) return previewItems;

    const norm = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .trim();
    const inSelection = (val: unknown, list: string[]) => {
      if (!list.length) return true;
      const v = norm(val);
      return list.some((i) => norm(i) === v);
    };
    const toDate = (val: unknown) => {
      if (!val) return null;
      const d = new Date(String(val));
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const matchesQuarter = (val: unknown) => {
      if (!sideFilters.quarters.length) return true;
      const d = toDate(val);
      if (!d) return false;
      const month = d.getMonth();
      const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4";
      return sideFilters.quarters.includes(q);
    };
    const withinDateRange = (val: unknown) => {
      const d = toDate(val);
      if (!d) return !(sideFilters.dateFrom || sideFilters.dateTo);
      if (sideFilters.dateFrom) {
        const from = toDate(sideFilters.dateFrom);
        if (from && d < from) return false;
      }
      if (sideFilters.dateTo) {
        const to = toDate(sideFilters.dateTo);
        if (to && d > to) return false;
      }
      return true;
    };

    const pickDateField = (row: Record<string, unknown>, cfg: any): unknown => {
      const candidates: (string | undefined)[] = [];
      if (cfg?.y_axis_mode === "date_diff") {
        candidates.push(cfg?.y_start_date_field || cfg?.y_field);
        candidates.push(cfg?.y_end_date_field);
      }
      candidates.push(
        "customer_job_posting_date",
        "created_at",
        "job_posting_date",
        "job_date"
      );
      for (const key of candidates) {
        if (!key) continue;
        const val = (row as Record<string, unknown>)[key];
        if (val !== undefined && val !== null && String(val).length) {
          return val;
        }
      }
      return row.customer_job_posting_date ?? row.created_at;
    };

    const pickValue = (
      row: Record<string, unknown>,
      keys: (string | undefined)[]
    ): unknown => {
      for (const key of keys) {
        if (!key) continue;
        const val = (row as Record<string, unknown>)[key];
        if (val !== undefined && val !== null) return val;
      }
      return undefined;
    };

    const filterRow = (row: Record<string, unknown>, cfg: any) => {
      const portfolioOk = inSelection(
        pickValue(row, [
          "portfolio",
          "customer_requirements.portfolio",
          "interviewed_candidate_details.portfolio",
          cfg?.group_by,
        ]),
        sideFilters.portfolios
      );
      const leaderOk = inSelection(
        pickValue(row, [
          "customer_leader",
          "customer_leaders",
          "customer_requirements.customer_leader",
          "customer_requirements.customer_leaders",
        ]),
        sideFilters.customerLeaders
      );
      const hiringOk = inSelection(
        pickValue(row, [
          "customer_hiring_manager",
          "customer_requirements.customer_hiring_manager",
        ]),
        sideFilters.customerHiringManagers
      );
      const hclLeaderOk = inSelection(
        pickValue(row, ["hcl_leader", "customer_requirements.hcl_leader"]),
        sideFilters.hclLeaders
      );
      const spocOk = inSelection(
        pickValue(row, [
          "hcl_deliver_spoc",
          "hcl_deliver_spocs",
          "customer_requirements.hcl_deliver_spoc",
          "customer_requirements.hcl_deliver_spocs",
        ]),
        sideFilters.hclDeliverSpocs
      );
      const dateField = pickDateField(row, cfg);
      const quarterOk = matchesQuarter(dateField);
      const dateRangeOk = withinDateRange(dateField);
      return (
        portfolioOk &&
        leaderOk &&
        hiringOk &&
        hclLeaderOk &&
        spocOk &&
        quarterOk &&
        dateRangeOk
      );
    };

    return previewItems.map((item) => ({
      ...item,
      rows: item.rows.filter((row) => filterRow(row, item.config)),
    }));
  }, [hasSideFilters, previewItems, sideFilters]);

  const displayedItems = hasSideFilters ? filteredPreviewItems : previewItems;

  const renderWidgetGrid = (items: typeof previewItems) => (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const isCollapsed = collapsedWidgetIds.includes(item.widgetId);
        return (
          <div
            key={item.widgetId}
            className={`flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 ${
              isCollapsed ? "space-y-1" : "space-y-3 h-[420px]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {item.title}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleWidgetCollapse(item.widgetId)}
                  className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                  aria-label={isCollapsed ? "Expand widget" : "Collapse widget"}
                >
                  <span aria-hidden>{isCollapsed ? "▸" : "▾"}</span>{" "}
                  {isCollapsed ? "Expand" : "Collapse"}
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <div className="flex h-full flex-col space-y-3">
                {item.widgetType === "chart" ? (
                  <DashboardChartPreview
                    title={item.title}
                    config={item.config as DashboardChartConfig}
                    columns={item.columns}
                    rows={item.rows}
                  />
                ) : (
                  <div className="h-full overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 shadow-inner dark:border-slate-700">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100">
                        <tr>
                          {(item.displayColumns || item.columns).map(
                            (c, idx) => (
                              <th
                                key={item.columns[idx] || c}
                                className="sticky top-0 z-10 whitespace-nowrap bg-slate-200/95 px-3 py-2 font-semibold backdrop-blur dark:bg-slate-700/95"
                              >
                                {c}
                              </th>
                            )
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {item.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            className={
                              idx % 2 === 0
                                ? "bg-white dark:bg-slate-900"
                                : "bg-slate-50 dark:bg-slate-800"
                            }
                          >
                            {item.columns.map((c) => (
                              <td
                                key={c}
                                className="whitespace-nowrap px-3 py-2 text-slate-800 dark:text-slate-200"
                              >
                                {row[c] === null || row[c] === undefined
                                  ? ""
                                  : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {!item.rows.length && (
                          <tr>
                            <td
                              colSpan={item.columns.length}
                              className="px-3 py-4 text-center text-slate-500 dark:text-slate-400"
                            >
                              No rows available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      {selectedDashboardId && (
        <Banner
          authToken={authToken}
          dashboardId={selectedDashboardId}
          authUserRole={authUserRole}
        />
      )}

      <div className={layoutClass}>
        <section className="flex min-h-[560px] flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-white p-5 shadow-lg dark:border-slate-700 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
          <div className="mt-4 flex flex-1 flex-col gap-3">
            <div
              className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-1 dark:border-slate-700"
              role="tablist"
            >
              {dashboardsLoading ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Loading dashboards...
                </span>
              ) : dashboards.length ? (
                dashboards.map((dash) => {
                  const active = dash.id === selectedDashboardId;
                  return (
                    <button
                      key={dash.id}
                      type="button"
                      onClick={() => setSelectedDashboardId(dash.id)}
                      role="tab"
                      aria-selected={active}
                      className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                        active
                          ? "border-b-2 border-sky-600 text-sky-700 dark:border-sky-400 dark:text-sky-100"
                          : "border-b-2 border-transparent text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
                      }`}
                    >
                      {dash.name}
                    </button>
                  );
                })
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  No dashboards yet. Ask an admin to create one.
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="relative w-[260px] max-w-full">
                <button
                  type="button"
                  disabled={!widgetOptions.length}
                  onClick={() => setWidgetPickerOpen((o) => !o)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300 dark:bg-slate-900 dark:text-slate-50 ${
                    widgetOptions.length
                      ? "border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-sky-600 dark:border-slate-700"
                      : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-500"
                  }`}
                >
                  <span>
                    {widgetOptions.length
                      ? selectedDashboardId
                        ? widgetSummary
                        : "Select a dashboard"
                      : "No widgets available"}
                  </span>
                  <span aria-hidden className="text-slate-400">
                    ▾
                  </span>
                </button>
                {widgetPickerOpen && widgetOptions.length > 0 && (
                  <div className="absolute z-30 mt-2 w-[260px] rounded-lg border border-slate-300 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={selectedWidgetIds.includes("all")}
                        onChange={() => handleWidgetToggle("all")}
                      />
                      All
                    </label>
                    {widgetOptions.map((w) => (
                      <label
                        key={w.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedWidgetIds.includes(w.id)}
                          onChange={() => handleWidgetToggle(w.id)}
                        />
                        {w.title}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/customer-requirement")}
                  className="inline-flex items-center gap-2 rounded-lg border border-sky-600 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
                >
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12 4v16m8-8H4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  New Job Posting
                </button>
                <button
                  type="button"
                  onClick={() => canOpenReport && setShowReportModal(true)}
                  disabled={!canOpenReport}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-emerald-400 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-slate-800"
                >
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7 17h3l8-8a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-8 8V17Zm0 0v3h3"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Update Job Posting
                </button>
                <button
                  type="button"
                  onClick={() => setOpenDemandsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-indigo-400 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800"
                >
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8c-1.8 0-3.5-.6-4.9-1.7"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 6v6l3 2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  InProgress Onboarding
                </button>
              </div>
            </div>
            {widgetLoading && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Loading widgets…
              </p>
            )}
            {widgetError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {widgetError}
              </p>
            )}
            {previewLoading && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Loading preview…
              </p>
            )}
            {previewError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {previewError}
              </p>
            )}
            {hasSideFilters ? (
              <div className="grid items-start gap-3 lg:grid-cols-[280px,1fr]">
                <aside className="flex max-h-[720px] flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Filters
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="text-[11px] font-semibold text-sky-700 underline hover:text-sky-800 dark:text-sky-300"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Filters apply to this dashboard only.
                  </p>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Portfolio</span>
                    <select
                      multiple
                      value={sideFilters.portfolios}
                      onChange={handleMultiSelect("portfolios")}
                      size={Math.min(4, portfolioOptions.length)}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {portfolioOptions.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Customer Leaders</span>
                    <select
                      multiple
                      value={sideFilters.customerLeaders}
                      onChange={handleMultiSelect("customerLeaders")}
                      size={6}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {customerLeaderOptions.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Customer Hiring Managers</span>
                    <select
                      multiple
                      value={sideFilters.customerHiringManagers}
                      onChange={handleMultiSelect("customerHiringManagers")}
                      size={6}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {customerHiringManagerOptions.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>HCL Leaders</span>
                    <select
                      multiple
                      value={sideFilters.hclLeaders}
                      onChange={handleMultiSelect("hclLeaders")}
                      size={Math.min(5, hclLeaderOptions.length)}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {hclLeaderOptions.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>HCL Deliver SPOCs</span>
                    <select
                      multiple
                      value={sideFilters.hclDeliverSpocs}
                      onChange={handleMultiSelect("hclDeliverSpocs")}
                      size={Math.min(5, hclDeliverSpocOptions.length)}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {hclDeliverSpocOptions.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <span>Quarter</span>
                    <select
                      multiple
                      value={sideFilters.quarters}
                      onChange={handleMultiSelect("quarters")}
                      size={4}
                      className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                    >
                      {QUARTERS.map((opt, i) => (
                        <option key={`${opt}-${i}`} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    <label className="flex flex-col gap-1">
                      <span>Date From</span>
                      <input
                        type="date"
                        value={sideFilters.dateFrom}
                        onChange={handleDateChange("dateFrom")}
                        className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Date To</span>
                      <input
                        type="date"
                        value={sideFilters.dateTo}
                        onChange={handleDateChange("dateTo")}
                        className="rounded-md border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-slate-700 dark:bg-slate-800"
                      />
                    </label>
                  </div>
                </aside>

                {renderWidgetGrid(displayedItems)}
              </div>
            ) : (
              renderWidgetGrid(displayedItems)
            )}
            <div className="pt-2" />
          </div>
        </section>

        {!hideChat && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <ChatWindow authToken={authToken} showSql={showSql} />
          </section>
        )}
      </div>

      <div className="pt-1 text-center">
        <button
          type="button"
          onClick={() => canOpenReport && setShowReportModal(true)}
          disabled={!canOpenReport}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-sky-500 dark:text-slate-900 dark:hover:bg-sky-400"
        >
          <svg
            aria-hidden
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 5c-5 0-8.5 4.5-9 6 .5 1.5 4 6 9 6s8.5-4.5 9-6c-.5-1.5-4-6-9-6Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx="12"
              cy="11"
              r="2.5"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
            />
          </svg>
          <span>View More Details</span>
        </button>
        {reportLoading && (
          <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Loading full data…
          </p>
        )}
        {reportError && (
          <p className="pt-1 text-[11px] text-rose-600 dark:text-rose-400">
            {reportError}
          </p>
        )}
      </div>

      <ReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        columns={reportColumns}
        rows={reportRows}
        onEditRecord={handleEditRecord}
        onDeleted={handleDeletedRecord}
      />

      <OpenDemandModal
        open={openDemandsOpen}
        rows={openDemandsRows}
        loading={openDemandsLoading}
        error={openDemandsError}
        onClose={handleOpenDemandsClose}
        editingId={openDemandsEditing}
        draft={openDemandsDraft}
        onEdit={handleOpenDemandsEdit}
        onChangeDraft={handleOpenDemandsChangeDraft}
        onSave={handleOpenDemandsSave}
        onCancel={handleOpenDemandsCancel}
        saving={openDemandsSaving}
      />
    </div>
  );
};

export default ChatWithDashboard;
