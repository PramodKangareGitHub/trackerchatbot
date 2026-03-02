import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PORTFOLIOS,
  DEFAULT_SUB_PORTFOLIOS,
  DEFAULT_TOWERS,
  DEFAULT_LOCATIONS,
  DEFAULT_SUB_LOCATIONS,
  DEFAULT_BUSINESS_UNITS,
  DEFAULT_REQUIREMENT_TYPES,
  DEFAULT_JOB_ROLES,
  DEFAULT_SKILL_CATEGORIES,
  DEFAULT_JOB_POSTING_STATUSES,
  DEFAULT_CUSTOMER_CIOS,
  DEFAULT_CUSTOMER_LEADERS,
  DEFAULT_CUSTOMER_VPS,
  DEFAULT_CUSTOMER_SENIOR_DIRECTORS,
  DEFAULT_CUSTOMER_DIRECTORS,
  DEFAULT_CUSTOMER_HIRING_MANAGERS,
  DEFAULT_CUSTOMER_BANDS,
  DEFAULT_HCL_LEADERS,
  DEFAULT_HCL_DELIVER_SPOCS,
} from "../../models/customerRequirementDefaults";

export type CustomerRequirementRecord = {
  unique_job_posting_id: string;
  portfolio?: string;
  sub_portfolio?: string;
  tower?: string;
  customer_cio?: string;
  customer_leader?: string;
  customer_vice_president?: string;
  customer_senior_director?: string;
  customer_director?: string;
  customer_hiring_manager?: string;
  customer_band?: string;
  hcl_leader?: string;
  hcl_deliver_spoc?: string;
  job_posting_id?: string;
  location?: string;
  sub_location?: string;
  requirement_type?: string;
  business_unit?: string;
  customer_job_posting_date?: string | null;
  number_of_positions?: number;
  sell_rate?: number | null;
  job_posting_status?: string;
  job_role?: string;
  skill_category?: string;
  primary_skills?: string;
  secondary_skills?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  modified_by?: string;
};

export type CustomerRequirementFormProps = {
  authToken?: string | null;
  currentUser?: string;
  onSave?: (records: CustomerRequirementRecord[]) => void;
  initialRecord?: Partial<CustomerRequirementRecord> | null;
  formId?: string;
  onUpdateRequest?: (
    payload: Partial<CustomerRequirementRecord>
  ) => Promise<void> | void;
};

const selectFieldClasses =
  "w-full rounded border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400";
const inputFieldClasses = selectFieldClasses;

const CustomerRequirementForm: React.FC<CustomerRequirementFormProps> = ({
  authToken,
  currentUser,
  onSave,
  initialRecord,
  formId,
  onUpdateRequest,
}) => {
  const toStr = (v: unknown) =>
    v === null || v === undefined ? "" : String(v);

  const toDateInput = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "";
    const s = String(v);
    // Handle ISO strings safely without timezone shifts
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) return isoMatch[1];
    // Fallback: try Date but still slice local YYYY-MM-DD
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getInitialForm = useCallback(
    () => ({
      portfolio: toStr(initialRecord?.portfolio),
      unique_job_posting_id: toStr(initialRecord?.unique_job_posting_id),
      sub_portfolio: toStr(initialRecord?.sub_portfolio),
      tower: toStr(initialRecord?.tower),
      customer_cio: toStr(initialRecord?.customer_cio),
      customer_leader: toStr(initialRecord?.customer_leader),
      customer_vice_president: toStr(initialRecord?.customer_vice_president),
      customer_senior_director: toStr(initialRecord?.customer_senior_director),
      customer_director: toStr(initialRecord?.customer_director),
      customer_hiring_manager: toStr(initialRecord?.customer_hiring_manager),
      customer_band: toStr(initialRecord?.customer_band),
      hcl_leader: toStr(initialRecord?.hcl_leader),
      hcl_deliver_spoc: toStr(initialRecord?.hcl_deliver_spoc),
      job_posting_id: toStr(initialRecord?.job_posting_id),
      location: toStr(initialRecord?.location),
      sub_location: toStr(initialRecord?.sub_location),
      requirement_type: toStr(initialRecord?.requirement_type),
      business_unit: toStr(initialRecord?.business_unit),
      customer_job_posting_date: toDateInput(
        initialRecord?.customer_job_posting_date
      ),
      sell_rate: toStr(initialRecord?.sell_rate),
      job_posting_status: toStr(initialRecord?.job_posting_status),
      job_role: toStr(initialRecord?.job_role),
      skill_category: toStr(initialRecord?.skill_category),
      primary_skills: toStr(initialRecord?.primary_skills),
      secondary_skills: toStr(initialRecord?.secondary_skills),
    }),
    [initialRecord]
  );

  const [form, setForm] = useState(getInitialForm);

  useEffect(() => {
    setForm(getInitialForm());
  }, [getInitialForm]);

  const todayIso = useMemo(() => new Date().toISOString(), []);
  const [portfolioOptions, setPortfolioOptions] =
    useState<string[]>(DEFAULT_PORTFOLIOS);
  const [subPortfolioOptions, setSubPortfolioOptions] = useState<string[]>(
    DEFAULT_SUB_PORTFOLIOS
  );
  const [towerOptions, setTowerOptions] = useState<string[]>(DEFAULT_TOWERS);
  const [locationOptions, setLocationOptions] =
    useState<string[]>(DEFAULT_LOCATIONS);
  const [subLocationOptions, setSubLocationOptions] = useState<string[]>(
    DEFAULT_SUB_LOCATIONS
  );
  const [businessUnitOptions, setBusinessUnitOptions] = useState<string[]>(
    DEFAULT_BUSINESS_UNITS
  );
  const [requirementTypeOptions, setRequirementTypeOptions] = useState<
    string[]
  >(DEFAULT_REQUIREMENT_TYPES);
  const [jobRoleOptions, setJobRoleOptions] =
    useState<string[]>(DEFAULT_JOB_ROLES);
  const [skillCategoryOptions, setSkillCategoryOptions] = useState<string[]>(
    DEFAULT_SKILL_CATEGORIES
  );
  const [jobPostingStatusOptions, setJobPostingStatusOptions] = useState<
    string[]
  >(DEFAULT_JOB_POSTING_STATUSES);
  const [customerCioOptions, setCustomerCioOptions] = useState<string[]>(
    DEFAULT_CUSTOMER_CIOS
  );
  const [customerLeaderOptions, setCustomerLeaderOptions] = useState<string[]>(
    DEFAULT_CUSTOMER_LEADERS
  );
  const [customerSeniorDirectorOptions, setCustomerSeniorDirectorOptions] =
    useState<string[]>(DEFAULT_CUSTOMER_SENIOR_DIRECTORS);
  const [customerVpOptions, setCustomerVpOptions] =
    useState<string[]>(DEFAULT_CUSTOMER_VPS);
  const [customerDirectorOptions, setCustomerDirectorOptions] = useState<
    string[]
  >(DEFAULT_CUSTOMER_DIRECTORS);
  const [customerHiringManagerOptions, setCustomerHiringManagerOptions] =
    useState<string[]>(DEFAULT_CUSTOMER_HIRING_MANAGERS);
  const [customerBandOptions, setCustomerBandOptions] = useState<string[]>(
    DEFAULT_CUSTOMER_BANDS
  );
  const [hclLeaderOptions, setHclLeaderOptions] =
    useState<string[]>(DEFAULT_HCL_LEADERS);
  const [hclDeliverSpocOptions, setHclDeliverSpocOptions] = useState<string[]>(
    DEFAULT_HCL_DELIVER_SPOCS
  );
  const [showPortfolioSuggestions, setShowPortfolioSuggestions] =
    useState(false);
  const [showSubPortfolioSuggestions, setShowSubPortfolioSuggestions] =
    useState(false);
  const [showTowerSuggestions, setShowTowerSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showSubLocationSuggestions, setShowSubLocationSuggestions] =
    useState(false);
  const [showBusinessUnitSuggestions, setShowBusinessUnitSuggestions] =
    useState(false);
  const [showRequirementTypeSuggestions, setShowRequirementTypeSuggestions] =
    useState(false);
  const [showJobRoleSuggestions, setShowJobRoleSuggestions] = useState(false);
  const [showSkillCategorySuggestions, setShowSkillCategorySuggestions] =
    useState(false);
  const [showJobPostingStatusSuggestions, setShowJobPostingStatusSuggestions] =
    useState(false);
  const [showCustomerCioSuggestions, setShowCustomerCioSuggestions] =
    useState(false);
  const [showCustomerLeaderSuggestions, setShowCustomerLeaderSuggestions] =
    useState(false);
  const [
    showCustomerSeniorDirectorSuggestions,
    setShowCustomerSeniorDirectorSuggestions,
  ] = useState(false);
  const [showCustomerVpSuggestions, setShowCustomerVpSuggestions] =
    useState(false);
  const [showCustomerDirectorSuggestions, setShowCustomerDirectorSuggestions] =
    useState(false);
  const [
    showCustomerHiringManagerSuggestions,
    setShowCustomerHiringManagerSuggestions,
  ] = useState(false);
  const [showCustomerBandSuggestions, setShowCustomerBandSuggestions] =
    useState(false);
  const [showHclLeaderSuggestions, setShowHclLeaderSuggestions] =
    useState(false);
  const [showHclDeliverSpocSuggestions, setShowHclDeliverSpocSuggestions] =
    useState(false);
  const [showCountModal, setShowCountModal] = useState(false);
  const [countInput, setCountInput] = useState("1");
  const [countError, setCountError] = useState("");
  const isEditMode = Boolean(initialRecord?.unique_job_posting_id);

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
        if (!res.ok) return;
        const data = await res.json();
        const mergedPortfolios = Array.isArray(data?.portfolios)
          ? Array.from(new Set([...DEFAULT_PORTFOLIOS, ...data.portfolios]))
          : DEFAULT_PORTFOLIOS;
        const mergedSubPortfolios = Array.isArray(data?.sub_portfolios)
          ? Array.from(
              new Set([...DEFAULT_SUB_PORTFOLIOS, ...data.sub_portfolios])
            )
          : DEFAULT_SUB_PORTFOLIOS;
        const mergedTowers = Array.isArray(data?.towers)
          ? Array.from(new Set([...DEFAULT_TOWERS, ...data.towers]))
          : DEFAULT_TOWERS;
        const mergedLocations = Array.isArray(data?.locations)
          ? Array.from(new Set([...DEFAULT_LOCATIONS, ...data.locations]))
          : DEFAULT_LOCATIONS;
        const mergedSubLocations = Array.isArray(data?.sub_locations)
          ? Array.from(
              new Set([...DEFAULT_SUB_LOCATIONS, ...data.sub_locations])
            )
          : DEFAULT_SUB_LOCATIONS;
        const mergedBusinessUnits = Array.isArray(data?.business_units)
          ? Array.from(
              new Set([...DEFAULT_BUSINESS_UNITS, ...data.business_units])
            )
          : DEFAULT_BUSINESS_UNITS;
        const mergedRequirementTypes = Array.isArray(data?.requirement_types)
          ? Array.from(
              new Set([...DEFAULT_REQUIREMENT_TYPES, ...data.requirement_types])
            )
          : DEFAULT_REQUIREMENT_TYPES;
        const mergedJobRoles = Array.isArray(data?.job_roles)
          ? Array.from(new Set([...DEFAULT_JOB_ROLES, ...data.job_roles]))
          : DEFAULT_JOB_ROLES;
        const mergedSkillCategories = Array.isArray(data?.skill_categories)
          ? Array.from(
              new Set([...DEFAULT_SKILL_CATEGORIES, ...data.skill_categories])
            )
          : DEFAULT_SKILL_CATEGORIES;
        const mergedJobPostingStatuses = Array.isArray(
          data?.job_posting_statuses
        )
          ? Array.from(
              new Set([
                ...DEFAULT_JOB_POSTING_STATUSES,
                ...data.job_posting_statuses,
              ])
            )
          : DEFAULT_JOB_POSTING_STATUSES;
        const mergedCustomerCios = Array.isArray(data?.customer_cios)
          ? Array.from(
              new Set([...DEFAULT_CUSTOMER_CIOS, ...data.customer_cios])
            )
          : DEFAULT_CUSTOMER_CIOS;
        const mergedCustomerLeaders = Array.isArray(data?.customer_leaders)
          ? Array.from(
              new Set([...DEFAULT_CUSTOMER_LEADERS, ...data.customer_leaders])
            )
          : DEFAULT_CUSTOMER_LEADERS;
        const mergedCustomerSeniorDirectors = Array.isArray(
          data?.customer_senior_directors
        )
          ? Array.from(
              new Set([
                ...DEFAULT_CUSTOMER_SENIOR_DIRECTORS,
                ...data.customer_senior_directors,
              ])
            )
          : DEFAULT_CUSTOMER_SENIOR_DIRECTORS;
        const mergedCustomerVps = Array.isArray(data?.customer_vps)
          ? Array.from(new Set([...DEFAULT_CUSTOMER_VPS, ...data.customer_vps]))
          : DEFAULT_CUSTOMER_VPS;
        const mergedCustomerDirectors = Array.isArray(data?.customer_directors)
          ? Array.from(
              new Set([
                ...DEFAULT_CUSTOMER_DIRECTORS,
                ...data.customer_directors,
              ])
            )
          : DEFAULT_CUSTOMER_DIRECTORS;
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
        const mergedCustomerBands = Array.isArray(data?.customer_bands)
          ? Array.from(
              new Set([...DEFAULT_CUSTOMER_BANDS, ...data.customer_bands])
            )
          : DEFAULT_CUSTOMER_BANDS;
        const mergedHclLeaders = Array.isArray(data?.hcl_leaders)
          ? Array.from(new Set([...DEFAULT_HCL_LEADERS, ...data.hcl_leaders]))
          : DEFAULT_HCL_LEADERS;
        const mergedHclDeliverSpocs = Array.isArray(data?.hcl_deliver_spocs)
          ? Array.from(
              new Set([...DEFAULT_HCL_DELIVER_SPOCS, ...data.hcl_deliver_spocs])
            )
          : DEFAULT_HCL_DELIVER_SPOCS;
        setPortfolioOptions(mergedPortfolios);
        setSubPortfolioOptions(mergedSubPortfolios);
        setTowerOptions(mergedTowers);
        setLocationOptions(mergedLocations);
        setSubLocationOptions(mergedSubLocations);
        setBusinessUnitOptions(mergedBusinessUnits);
        setRequirementTypeOptions(mergedRequirementTypes);
        setJobRoleOptions(mergedJobRoles);
        setSkillCategoryOptions(mergedSkillCategories);
        setJobPostingStatusOptions(mergedJobPostingStatuses);
        setCustomerCioOptions(mergedCustomerCios);
        setCustomerLeaderOptions(mergedCustomerLeaders);
        setCustomerSeniorDirectorOptions(mergedCustomerSeniorDirectors);
        setCustomerVpOptions(mergedCustomerVps);
        setCustomerDirectorOptions(mergedCustomerDirectors);
        setCustomerHiringManagerOptions(mergedCustomerHiringManagers);
        setCustomerBandOptions(mergedCustomerBands);
        setHclLeaderOptions(mergedHclLeaders);
        setHclDeliverSpocOptions(mergedHclDeliverSpocs);
      } catch (err) {
        console.error("Failed to load defaults", err);
        setPortfolioOptions(DEFAULT_PORTFOLIOS);
        setSubPortfolioOptions(DEFAULT_SUB_PORTFOLIOS);
        setTowerOptions(DEFAULT_TOWERS);
        setLocationOptions(DEFAULT_LOCATIONS);
        setSubLocationOptions(DEFAULT_SUB_LOCATIONS);
        setBusinessUnitOptions(DEFAULT_BUSINESS_UNITS);
        setRequirementTypeOptions(DEFAULT_REQUIREMENT_TYPES);
        setJobRoleOptions(DEFAULT_JOB_ROLES);
        setSkillCategoryOptions(DEFAULT_SKILL_CATEGORIES);
        setJobPostingStatusOptions(DEFAULT_JOB_POSTING_STATUSES);
        setCustomerCioOptions(DEFAULT_CUSTOMER_CIOS);
        setCustomerLeaderOptions(DEFAULT_CUSTOMER_LEADERS);
        setCustomerSeniorDirectorOptions(DEFAULT_CUSTOMER_SENIOR_DIRECTORS);
        setCustomerVpOptions(DEFAULT_CUSTOMER_VPS);
        setCustomerDirectorOptions(DEFAULT_CUSTOMER_DIRECTORS);
        setCustomerHiringManagerOptions(DEFAULT_CUSTOMER_HIRING_MANAGERS);
        setCustomerBandOptions(DEFAULT_CUSTOMER_BANDS);
        setHclLeaderOptions(DEFAULT_HCL_LEADERS);
        setHclDeliverSpocOptions(DEFAULT_HCL_DELIVER_SPOCS);
      }
    };

    loadDefaults();
  }, [authToken]);

  const filteredPortfolios = portfolioOptions.filter((option) =>
    option.toLowerCase().includes((form.portfolio || "").toLowerCase())
  );
  const filteredSubPortfolios = subPortfolioOptions.filter((option) =>
    option.toLowerCase().includes((form.sub_portfolio || "").toLowerCase())
  );
  const filteredTowers = towerOptions.filter((option) =>
    option.toLowerCase().includes((form.tower || "").toLowerCase())
  );
  const filteredLocations = locationOptions.filter((option) =>
    option.toLowerCase().includes((form.location || "").toLowerCase())
  );
  const filteredSubLocations = subLocationOptions.filter((option) =>
    option.toLowerCase().includes((form.sub_location || "").toLowerCase())
  );
  const filteredBusinessUnits = businessUnitOptions.filter((option) =>
    option.toLowerCase().includes((form.business_unit || "").toLowerCase())
  );
  const filteredRequirementTypes = requirementTypeOptions.filter((option) =>
    option.toLowerCase().includes((form.requirement_type || "").toLowerCase())
  );
  const filteredJobRoles = jobRoleOptions.filter((option) =>
    option.toLowerCase().includes((form.job_role || "").toLowerCase())
  );
  const filteredSkillCategories = skillCategoryOptions.filter((option) =>
    option.toLowerCase().includes((form.skill_category || "").toLowerCase())
  );
  const filteredJobPostingStatuses = jobPostingStatusOptions.filter((option) =>
    option.toLowerCase().includes((form.job_posting_status || "").toLowerCase())
  );
  const filteredCustomerCios = customerCioOptions.filter((option) =>
    option.toLowerCase().includes((form.customer_cio || "").toLowerCase())
  );
  const filteredCustomerLeaders = customerLeaderOptions.filter((option) =>
    option.toLowerCase().includes((form.customer_leader || "").toLowerCase())
  );
  const filteredCustomerSeniorDirectors = customerSeniorDirectorOptions.filter(
    (option) =>
      option
        .toLowerCase()
        .includes((form.customer_senior_director || "").toLowerCase())
  );
  const filteredCustomerVps = customerVpOptions.filter((option) =>
    option
      .toLowerCase()
      .includes((form.customer_vice_president || "").toLowerCase())
  );
  const filteredCustomerHiringManagers = customerHiringManagerOptions.filter(
    (option) =>
      option
        .toLowerCase()
        .includes((form.customer_hiring_manager || "").toLowerCase())
  );
  const filteredCustomerBands = customerBandOptions.filter((option) =>
    option.toLowerCase().includes((form.customer_band || "").toLowerCase())
  );
  const filteredHclLeaders = hclLeaderOptions.filter((option) =>
    option.toLowerCase().includes((form.hcl_leader || "").toLowerCase())
  );
  const filteredHclDeliverSpocs = hclDeliverSpocOptions.filter((option) =>
    option.toLowerCase().includes((form.hcl_deliver_spoc || "").toLowerCase())
  );
  const filteredCustomerDirectors = customerDirectorOptions.filter((option) =>
    option.toLowerCase().includes((form.customer_director || "").toLowerCase())
  );

  const normalizeForCompare = useMemo(() => {
    const normalizeNumber = (val: unknown) => {
      if (val === null || val === undefined || val === "") return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    return {
      portfolio: initialRecord?.portfolio || undefined,
      sub_portfolio: initialRecord?.sub_portfolio || undefined,
      tower: initialRecord?.tower || undefined,
      customer_cio: initialRecord?.customer_cio || undefined,
      customer_leader: initialRecord?.customer_leader || undefined,
      customer_vice_president:
        initialRecord?.customer_vice_president || undefined,
      customer_senior_director:
        initialRecord?.customer_senior_director || undefined,
      customer_director: initialRecord?.customer_director || undefined,
      customer_hiring_manager:
        initialRecord?.customer_hiring_manager || undefined,
      customer_band: initialRecord?.customer_band || undefined,
      hcl_leader: initialRecord?.hcl_leader || undefined,
      hcl_deliver_spoc: initialRecord?.hcl_deliver_spoc || undefined,
      job_posting_id: initialRecord?.job_posting_id || undefined,
      location: initialRecord?.location || undefined,
      sub_location: initialRecord?.sub_location || undefined,
      requirement_type: initialRecord?.requirement_type || undefined,
      business_unit: initialRecord?.business_unit || undefined,
      customer_job_posting_date:
        toDateInput(initialRecord?.customer_job_posting_date) || null,
      number_of_positions: initialRecord?.number_of_positions,
      sell_rate: normalizeNumber(initialRecord?.sell_rate),
      job_posting_status: initialRecord?.job_posting_status || undefined,
      job_role: initialRecord?.job_role || undefined,
      skill_category: initialRecord?.skill_category || undefined,
      primary_skills: initialRecord?.primary_skills || undefined,
      secondary_skills: initialRecord?.secondary_skills || undefined,
    } satisfies Partial<CustomerRequirementRecord>;
  }, [initialRecord]);

  const buildUpdatePayload = (): Partial<CustomerRequirementRecord> => {
    const normalizeNumber = (val: string) => {
      if (!val) return null;
      const num = Number(val);
      return Number.isFinite(num) ? num : null;
    };

    const payload: Partial<CustomerRequirementRecord> = {
      portfolio: form.portfolio || undefined,
      sub_portfolio: form.sub_portfolio || undefined,
      tower: form.tower || undefined,
      customer_cio: form.customer_cio || undefined,
      customer_leader: form.customer_leader || undefined,
      customer_vice_president: form.customer_vice_president || undefined,
      customer_senior_director: form.customer_senior_director || undefined,
      customer_director: form.customer_director || undefined,
      customer_hiring_manager: form.customer_hiring_manager || undefined,
      customer_band: form.customer_band || undefined,
      hcl_leader: form.hcl_leader || undefined,
      hcl_deliver_spoc: form.hcl_deliver_spoc || undefined,
      job_posting_id: form.job_posting_id || undefined,
      location: form.location || undefined,
      sub_location: form.sub_location || undefined,
      requirement_type: form.requirement_type || undefined,
      business_unit: form.business_unit || undefined,
      customer_job_posting_date: form.customer_job_posting_date || null,
      number_of_positions: initialRecord?.number_of_positions,
      sell_rate: normalizeNumber(form.sell_rate),
      job_posting_status: form.job_posting_status || undefined,
      job_role: form.job_role || undefined,
      skill_category: form.skill_category || undefined,
      primary_skills: form.primary_skills || undefined,
      secondary_skills: form.secondary_skills || undefined,
    };

    const diff: Partial<CustomerRequirementRecord> = {};
    const diffRecord = diff as Record<
      keyof CustomerRequirementRecord,
      CustomerRequirementRecord[keyof CustomerRequirementRecord] | undefined
    >;
    const normalize = (val: unknown) => (val === undefined ? null : val);

    (Object.keys(payload) as Array<keyof CustomerRequirementRecord>).forEach(
      (key) => {
        const nextVal = normalize(payload[key]);
        const initialVal = normalize(
          (
            normalizeForCompare as Record<
              keyof CustomerRequirementRecord,
              unknown
            >
          )[key]
        );
        if (nextVal !== initialVal) {
          diffRecord[key] = payload[key];
        }
      }
    );

    if (Object.keys(diff).length > 0) {
      diff.modified_by = currentUser || initialRecord?.modified_by || "system";
    }

    return diff;
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdate = async () => {
    if (!authToken) {
      alert("You must be signed in to update.");
      return;
    }
    if (!initialRecord?.unique_job_posting_id) {
      alert("Missing unique job posting id for update.");
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const payload = buildUpdatePayload();

    if (onUpdateRequest) {
      try {
        await onUpdateRequest(payload);
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    if (Object.keys(payload).length === 0) {
      alert("No changes to update.");
      return;
    }

    try {
      const res = await fetch(
        `${apiBase}/api/customer-requirements/${encodeURIComponent(
          initialRecord.unique_job_posting_id
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
        throw new Error(body.detail || res.statusText || "Failed to update");
      }
      alert("Updated successfully.");
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const { job_posting_id } = form;

    if (!job_posting_id) {
      alert("Job Posting ID is required");
      return;
    }
    if (isEditMode) {
      void handleUpdate();
      return;
    }
    setCountInput("1");
    setCountError("");
    setShowCountModal(true);
  };

  const handleConfirmPositions = async () => {
    const parsed = Number(countInput);
    const count = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
    if (count < 1) {
      setCountError("Number of positions must be at least 1");
      return;
    }

    setCountError("");

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    let startIndex = 1;
    try {
      const res = await fetch(
        `${apiBase}/api/customer-requirements/next-index?job_posting_id=${encodeURIComponent(
          form.job_posting_id || ""
        )}`,
        {
          headers: authToken
            ? { Authorization: `Bearer ${authToken}` }
            : undefined,
        }
      );
      if (res.ok) {
        const data = await res.json();
        const parsedNext = Number(data?.next_index);
        startIndex =
          Number.isFinite(parsedNext) && parsedNext > 0 ? parsedNext : 1;
      } else {
        setCountError("Could not fetch next sequence for this Job Posting ID.");
        return;
      }
    } catch (err) {
      console.error("Failed to fetch next index", err);
      setCountError("Could not fetch next sequence for this Job Posting ID.");
      return;
    }

    const records: CustomerRequirementRecord[] = Array.from({
      length: count,
    }).map((_, idx) => ({
      unique_job_posting_id: `${form.job_posting_id}_${startIndex + idx}`,
      portfolio: form.portfolio || undefined,
      sub_portfolio: form.sub_portfolio || undefined,
      tower: form.tower || undefined,
      customer_cio: form.customer_cio || undefined,
      customer_leader: form.customer_leader || undefined,
      customer_vice_president: form.customer_vice_president || undefined,
      customer_senior_director: form.customer_senior_director || undefined,
      customer_director: form.customer_director || undefined,
      customer_hiring_manager: form.customer_hiring_manager || undefined,
      customer_band: form.customer_band || undefined,
      hcl_leader: form.hcl_leader || undefined,
      hcl_deliver_spoc: form.hcl_deliver_spoc || undefined,
      job_posting_id: form.job_posting_id || undefined,
      location: form.location || undefined,
      sub_location: form.sub_location || undefined,
      requirement_type: form.requirement_type || undefined,
      business_unit: form.business_unit || undefined,
      customer_job_posting_date: form.customer_job_posting_date || null,
      number_of_positions: count,
      sell_rate: form.sell_rate ? Number(form.sell_rate) : null,
      job_posting_status: form.job_posting_status || undefined,
      job_role: form.job_role || undefined,
      skill_category: form.skill_category || undefined,
      primary_skills: form.primary_skills || undefined,
      secondary_skills: form.secondary_skills || undefined,
      created_at: todayIso,
      updated_at: todayIso,
      created_by: currentUser || "system",
      modified_by: currentUser || "system",
    }));

    setShowCountModal(false);
    setCountError("");

    if (onSave) {
      onSave(records);
    }

    // Reset the form after saving to start fresh
    handleClear();
    setCountInput("1");
  };

  const handleClear = () => {
    setForm(getInitialForm());
    setShowPortfolioSuggestions(false);
    setShowSubPortfolioSuggestions(false);
    setShowTowerSuggestions(false);
    setShowLocationSuggestions(false);
    setShowSubLocationSuggestions(false);
    setShowBusinessUnitSuggestions(false);
    setShowRequirementTypeSuggestions(false);
    setShowJobRoleSuggestions(false);
    setShowSkillCategorySuggestions(false);
    setShowJobPostingStatusSuggestions(false);
    setShowCustomerCioSuggestions(false);
    setShowCustomerLeaderSuggestions(false);
    setShowCustomerSeniorDirectorSuggestions(false);
    setShowCustomerVpSuggestions(false);
    setShowCustomerDirectorSuggestions(false);
    setShowCustomerHiringManagerSuggestions(false);
    setShowCustomerBandSuggestions(false);
    setShowHclLeaderSuggestions(false);
    setShowHclDeliverSpocSuggestions(false);
  };

  const handleCancel = () => {
    window.location.href = "/";
  };

  return (
    <form id={formId} className="space-y-4 py-4" onSubmit={handleSave}>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Portfolio</span>
          <div className="relative">
            <input
              name="portfolio"
              value={form.portfolio}
              onChange={(e) => {
                handleChange(e);
                setShowPortfolioSuggestions(true);
              }}
              onFocus={() => setShowPortfolioSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowPortfolioSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showPortfolioSuggestions && filteredPortfolios.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredPortfolios.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, portfolio: option }));
                      setShowPortfolioSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Sub Portfolio</span>
          <div className="relative">
            <input
              name="sub_portfolio"
              value={form.sub_portfolio}
              onChange={(e) => {
                handleChange(e);
                setShowSubPortfolioSuggestions(true);
              }}
              onFocus={() => setShowSubPortfolioSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowSubPortfolioSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showSubPortfolioSuggestions &&
              filteredSubPortfolios.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredSubPortfolios.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          sub_portfolio: option,
                        }));
                        setShowSubPortfolioSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Tower</span>
          <div className="relative">
            <input
              name="tower"
              value={form.tower}
              onChange={(e) => {
                handleChange(e);
                setShowTowerSuggestions(true);
              }}
              onFocus={() => setShowTowerSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowTowerSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showTowerSuggestions && filteredTowers.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredTowers.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, tower: option }));
                      setShowTowerSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Customer CIO</span>
          <div className="relative">
            <input
              name="customer_cio"
              value={form.customer_cio}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerCioSuggestions(true);
              }}
              onFocus={() => setShowCustomerCioSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerCioSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerCioSuggestions && filteredCustomerCios.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredCustomerCios.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, customer_cio: option }));
                      setShowCustomerCioSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Customer Leader</span>
          <div className="relative">
            <input
              name="customer_leader"
              value={form.customer_leader}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerLeaderSuggestions(true);
              }}
              onFocus={() => setShowCustomerLeaderSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerLeaderSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerLeaderSuggestions &&
              filteredCustomerLeaders.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredCustomerLeaders.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          customer_leader: option,
                        }));
                        setShowCustomerLeaderSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Customer VP</span>
          <div className="relative">
            <input
              name="customer_vice_president"
              value={form.customer_vice_president}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerVpSuggestions(true);
              }}
              onFocus={() => setShowCustomerVpSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerVpSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerVpSuggestions && filteredCustomerVps.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredCustomerVps.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        customer_vice_president: option,
                      }));
                      setShowCustomerVpSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">
            Customer Sr Director
          </span>
          <div className="relative">
            <input
              name="customer_senior_director"
              value={form.customer_senior_director}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerSeniorDirectorSuggestions(true);
              }}
              onFocus={() => setShowCustomerSeniorDirectorSuggestions(true)}
              onBlur={() =>
                setTimeout(
                  () => setShowCustomerSeniorDirectorSuggestions(false),
                  150
                )
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerSeniorDirectorSuggestions &&
              filteredCustomerSeniorDirectors.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredCustomerSeniorDirectors.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          customer_senior_director: option,
                        }));
                        setShowCustomerSeniorDirectorSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Customer Director</span>
          <div className="relative">
            <input
              name="customer_director"
              value={form.customer_director}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerDirectorSuggestions(true);
              }}
              onFocus={() => setShowCustomerDirectorSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerDirectorSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerDirectorSuggestions &&
              filteredCustomerDirectors.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredCustomerDirectors.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          customer_director: option,
                        }));
                        setShowCustomerDirectorSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">
            Customer Hiring Manager
          </span>
          <div className="relative">
            <input
              name="customer_hiring_manager"
              value={form.customer_hiring_manager}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerHiringManagerSuggestions(true);
              }}
              onFocus={() => setShowCustomerHiringManagerSuggestions(true)}
              onBlur={() =>
                setTimeout(
                  () => setShowCustomerHiringManagerSuggestions(false),
                  150
                )
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerHiringManagerSuggestions &&
              filteredCustomerHiringManagers.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredCustomerHiringManagers.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          customer_hiring_manager: option,
                        }));
                        setShowCustomerHiringManagerSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Customer Band</span>
          <div className="relative">
            <input
              name="customer_band"
              value={form.customer_band}
              onChange={(e) => {
                handleChange(e);
                setShowCustomerBandSuggestions(true);
              }}
              onFocus={() => setShowCustomerBandSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowCustomerBandSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showCustomerBandSuggestions &&
              filteredCustomerBands.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredCustomerBands.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, customer_band: option }));
                        setShowCustomerBandSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">HCL Leader</span>
          <div className="relative">
            <input
              name="hcl_leader"
              value={form.hcl_leader}
              onChange={(e) => {
                handleChange(e);
                setShowHclLeaderSuggestions(true);
              }}
              onFocus={() => setShowHclLeaderSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowHclLeaderSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showHclLeaderSuggestions && filteredHclLeaders.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredHclLeaders.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, hcl_leader: option }));
                      setShowHclLeaderSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">HCL Delivery SPOC</span>
          <div className="relative">
            <input
              name="hcl_deliver_spoc"
              value={form.hcl_deliver_spoc}
              onChange={(e) => {
                handleChange(e);
                setShowHclDeliverSpocSuggestions(true);
              }}
              onFocus={() => setShowHclDeliverSpocSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowHclDeliverSpocSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showHclDeliverSpocSuggestions &&
              filteredHclDeliverSpocs.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredHclDeliverSpocs.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          hcl_deliver_spoc: option,
                        }));
                        setShowHclDeliverSpocSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
      </div>

      <div
        className="my-6 h-0.5 w-full bg-black dark:bg-slate-100"
        aria-hidden="true"
      />

      <div className="grid grid-cols-3 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">
            Unique Job Posting ID
          </span>
          <input
            name="unique_job_posting_id"
            value={form.unique_job_posting_id}
            onChange={handleChange}
            className={inputFieldClasses}
            disabled
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Job Posting ID</span>
          <input
            name="job_posting_id"
            value={form.job_posting_id}
            onChange={handleChange}
            className={inputFieldClasses}
            disabled={isEditMode}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Location</span>
          <div className="relative">
            <input
              name="location"
              value={form.location}
              onChange={(e) => {
                handleChange(e);
                setShowLocationSuggestions(true);
              }}
              onFocus={() => setShowLocationSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowLocationSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showLocationSuggestions && filteredLocations.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredLocations.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, location: option }));
                      setShowLocationSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Sub Location</span>
          <div className="relative">
            <input
              name="sub_location"
              value={form.sub_location}
              onChange={(e) => {
                handleChange(e);
                setShowSubLocationSuggestions(true);
              }}
              onFocus={() => setShowSubLocationSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowSubLocationSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showSubLocationSuggestions && filteredSubLocations.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredSubLocations.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, sub_location: option }));
                      setShowSubLocationSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Requirement Type</span>
          <div className="relative">
            <input
              name="requirement_type"
              value={form.requirement_type}
              onChange={(e) => {
                handleChange(e);
                setShowRequirementTypeSuggestions(true);
              }}
              onFocus={() => setShowRequirementTypeSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowRequirementTypeSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showRequirementTypeSuggestions &&
              filteredRequirementTypes.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredRequirementTypes.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          requirement_type: option,
                        }));
                        setShowRequirementTypeSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Business Unit</span>
          <div className="relative">
            <input
              name="business_unit"
              value={form.business_unit}
              onChange={(e) => {
                handleChange(e);
                setShowBusinessUnitSuggestions(true);
              }}
              onFocus={() => setShowBusinessUnitSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowBusinessUnitSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showBusinessUnitSuggestions &&
              filteredBusinessUnits.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredBusinessUnits.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, business_unit: option }));
                        setShowBusinessUnitSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">
            Customer Job Posting Date
          </span>
          <input
            type="date"
            name="customer_job_posting_date"
            value={form.customer_job_posting_date}
            onChange={handleChange}
            className={inputFieldClasses}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Sell Rate</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-600">$</span>
            <input
              type="number"
              step="0.01"
              name="sell_rate"
              value={form.sell_rate}
              onChange={handleChange}
              className={inputFieldClasses}
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Job Posting Status</span>
          <div className="relative">
            <input
              name="job_posting_status"
              value={form.job_posting_status}
              onChange={(e) => {
                handleChange(e);
                setShowJobPostingStatusSuggestions(true);
              }}
              onFocus={() => setShowJobPostingStatusSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowJobPostingStatusSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showJobPostingStatusSuggestions &&
              filteredJobPostingStatuses.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredJobPostingStatuses.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          job_posting_status: option,
                        }));
                        setShowJobPostingStatusSuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
      </div>

      <div
        className="my-6 h-0.5 w-full bg-black dark:bg-slate-100"
        aria-hidden="true"
      />

      <div className="grid grid-cols-3 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Job Family</span>
          <div className="relative">
            <input
              name="job_role"
              value={form.job_role}
              onChange={(e) => {
                handleChange(e);
                setShowJobRoleSuggestions(true);
              }}
              onFocus={() => setShowJobRoleSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowJobRoleSuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showJobRoleSuggestions && filteredJobRoles.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {filteredJobRoles.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, job_role: option }));
                      setShowJobRoleSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Skill Family</span>
          <div className="relative">
            <input
              name="skill_category"
              value={form.skill_category}
              onChange={(e) => {
                handleChange(e);
                setShowSkillCategorySuggestions(true);
              }}
              onFocus={() => setShowSkillCategorySuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowSkillCategorySuggestions(false), 150)
              }
              className={inputFieldClasses}
              autoComplete="off"
            />
            {showSkillCategorySuggestions &&
              filteredSkillCategories.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {filteredSkillCategories.map((option) => (
                    <button
                      type="button"
                      key={option}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          skill_category: option,
                        }));
                        setShowSkillCategorySuggestions(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Primary Skills</span>
          <textarea
            name="primary_skills"
            value={form.primary_skills}
            onChange={handleChange}
            className={`${inputFieldClasses} min-h-[120px]`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium text-slate-700">Secondary Skills</span>
          <textarea
            name="secondary_skills"
            value={form.secondary_skills}
            onChange={handleChange}
            className={`${inputFieldClasses} min-h-[120px]`}
          />
        </label>
      </div>

      {!isEditMode && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Save
          </button>
        </div>
      )}

      {showCountModal && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              Number of positions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              How many positions do you want to create for this Job Posting ID?
            </p>
            <div className="mt-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">Count</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={countInput}
                  onChange={(e) => setCountInput(e.target.value)}
                  className={inputFieldClasses}
                  autoFocus
                />
              </label>
              {countError && (
                <p className="mt-2 text-sm text-red-600">{countError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCountModal(false);
                  setCountError("");
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPositions}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default CustomerRequirementForm;
