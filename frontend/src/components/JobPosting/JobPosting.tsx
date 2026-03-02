import React, { useEffect, useMemo, useState } from "react";
import CustomerRequirementForm, {
  CustomerRequirementRecord,
} from "./CustomerRequirementForm";
import HclDemand, { HclDemandFormState } from "./HclDemand";
import InterviewedCandidateDetail, {
  InterviewedCandidateFormState,
} from "./InterviewedCandidateDetail";
import HclOnboardingStatus, {
  HclOnboardingFormState,
} from "./HclOnboardingStatus";
import OptumOnboardingStatus, {
  OptumOnboardingFormState,
} from "./OptumOnboardingStatus";

export type JobPostingProps = {
  initialRequirement?: Partial<CustomerRequirementRecord> | null;
  authToken?: string | null;
  currentUser?: string | null;
  viewOnly?: boolean;
};

const AccordionItem: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-900 bg-slate-100"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span
          aria-hidden
          className={`ml-3 inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-base text-slate-600 transition-transform ${
            isOpen ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden border-t border-slate-200 transition-[max-height] duration-300 ${
          isOpen ? "max-h-[2000px]" : "max-h-0"
        }`}
      >
        <div className="px-5 py-4 bg-gradient-to-b from-white to-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
};

const DisplayGrid: React.FC<{
  fields: { label: string; value: React.ReactNode }[];
}> = ({ fields }) => {
  const renderValue = (val: React.ReactNode) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-slate-400">—</span>;
    }
    return val;
  };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {fields.map((field) => (
        <div
          key={field.label}
          className="space-y-1 rounded-lg border border-slate-200 bg-white/60 px-3 py-2 text-sm shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {field.label}
          </div>
          <div className="text-sm text-slate-800 break-words">
            {renderValue(field.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

const defaultHclDemand: HclDemandFormState = {
  demand_id: "",
  tag_spoc: "",
  tsc_spoc: "",
  demand_created_date: "",
  demand_status: "",
  demand_approved_date: "",
  tag_first_profile_sourced_date: "",
  tsc_first_profile_sourced_date: "",
  tp_profiles_requested: "Yes",
  tp_vendor_name: "",
  tp_profiles_requested_date: "",
  tp_first_profile_sourced_date: "",
};

const defaultCandidate: InterviewedCandidateFormState = {
  candidate_contact: "",
  candidate_name: "",
  candidate_email: "",
  candidate_type: "",
  tp_vendor_name: "",
  interview_status: "",
  initial_screening_status: "",
  initial_screening_rejected_reason: "",
  tp1_interview_status: "",
  tp1_rejected_reason: "",
  tp2_interview_status: "",
  tp2_skipped_rejected_reason: "",
  manager_interview_status: "",
  manager_skipped_rejected_reason: "",
  customer_interview_status: "",
  customer_interview_skipped_rejected_reason: "",
  candidate_selected_date: "",
};

const defaultOnboarding: HclOnboardingFormState = {
  sap_id: "",
  candidate_contact: "",
  candidate_email: "",
  hcl_onboarding_status: "",
  hire_loss_reason: "",
  onboarded_date: "",
  employee_name: "",
  employee_hcl_email: "",
};

const defaultOptumOnboarding: OptumOnboardingFormState = {
  customer_employee_id: "",
  sap_id: "",
  customer_onboarding_status: "",
  customer_onboarded_date: "",
  customer_employee_name: "",
  customer_email: "",
  customer_login_id: "",
  customer_lob: "",
  billing_start_date: "",
  customer_laptop_required: "",
  customer_laptop_status: "",
  customer_laptop_serial_no: "",
};

const JobPosting: React.FC<JobPostingProps> = ({
  initialRequirement,
  authToken,
  currentUser,
  viewOnly = false,
}) => {
  const isEditMode = Boolean(initialRequirement?.unique_job_posting_id);
  const [openSections, setOpenSections] = useState(() => ({
    customer: isEditMode ? false : true,
    hcl: true,
    candidates: true,
    onboarding: true,
    optumOnboarding: true,
  }));
  const formId = "customer-requirement-form";
  const [updating, setUpdating] = useState(false);
  const [hclDemand, setHclDemand] =
    useState<HclDemandFormState>(defaultHclDemand);
  const [initialHclDemand, setInitialHclDemand] = useState<HclDemandFormState>(
    () => ({
      ...defaultHclDemand,
    })
  );
  const [candidates, setCandidates] = useState<InterviewedCandidateFormState[]>(
    [{ ...defaultCandidate }]
  );
  const [initialCandidates, setInitialCandidates] = useState<
    InterviewedCandidateFormState[]
  >([]);
  const [onboarding, setOnboarding] =
    useState<HclOnboardingFormState>(defaultOnboarding);
  const [initialOnboarding, setInitialOnboarding] =
    useState<HclOnboardingFormState>(defaultOnboarding);
  const [optumOnboarding, setOptumOnboarding] =
    useState<OptumOnboardingFormState>(defaultOptumOnboarding);
  const [initialOptumOnboarding, setInitialOptumOnboarding] =
    useState<OptumOnboardingFormState>(defaultOptumOnboarding);

  useEffect(() => {
    const uniqueId = initialRequirement?.unique_job_posting_id;
    if (!uniqueId) return;
    if (!hclDemand.demand_id.trim()) return;

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const toDateInput = (value?: string | null) => {
      if (!value) return "";
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const load = async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/hcl-demand/${encodeURIComponent(uniqueId)}`,
          { headers }
        );
        if (!res.ok) return;
        const data = await res.json();
        const next: HclDemandFormState = {
          demand_id: data?.demand_id || "",
          tag_spoc: data?.tag_spoc || "",
          tsc_spoc: data?.tsc_spoc || "",
          demand_created_date: toDateInput(data?.demand_created_date),
          demand_status: data?.demand_status || "",
          demand_approved_date: toDateInput(data?.demand_approved_date),
          tag_first_profile_sourced_date: toDateInput(
            data?.tag_first_profile_sourced_date
          ),
          tsc_first_profile_sourced_date: toDateInput(
            data?.tsc_first_profile_sourced_date
          ),
          tp_profiles_requested:
            data?.tp_profiles_requested === 1 ? "Yes" : "No",
          tp_vendor_name: data?.tp_vendor_name || "",
          tp_profiles_requested_date: toDateInput(
            data?.tp_profiles_requested_date
          ),
          tp_first_profile_sourced_date: toDateInput(
            data?.tp_first_profile_sourced_date
          ),
        };
        setHclDemand(next);
        setInitialHclDemand(next);
      } catch (err) {
        console.error("Failed to load HCL demand", err);
      }
    };

    void load();
  }, [authToken, initialRequirement?.unique_job_posting_id]);

  useEffect(() => {
    const uniqueId = initialRequirement?.unique_job_posting_id;
    if (!uniqueId) return;

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const toDateInput = (value?: string | null) => {
      if (!value) return "";
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const load = async () => {
      try {
        const url = new URL(
          `${apiBase}/api/interviewed-candidates/${encodeURIComponent(uniqueId)}`
        );
        if (hclDemand.demand_id.trim()) {
          url.searchParams.set("demand_id", hclDemand.demand_id.trim());
        }
        const res = await fetch(url.toString(), { headers });
        if (!res.ok) return;
        const data = await res.json();
        const mapped: InterviewedCandidateFormState[] = Array.isArray(data)
          ? data.map((item) => ({
              candidate_contact: item?.candidate_contact || "",
              candidate_name: item?.candidate_name || "",
              candidate_email: item?.candidate_email || "",
              candidate_type: item?.candidate_type || "",
              tp_vendor_name: item?.tp_vendor_name || "",
              interview_status: item?.interview_status || "",
              initial_screening_status: item?.initial_screening_status || "",
              initial_screening_rejected_reason:
                item?.initial_screening_rejected_reason || "",
              tp1_interview_status: item?.tp1_interview_status || "",
              tp1_rejected_reason: item?.tp1_rejected_reason || "",
              tp2_interview_status: item?.tp2_interview_status || "",
              tp2_skipped_rejected_reason:
                item?.tp2_skipped_rejected_reason || "",
              manager_interview_status: item?.manager_interview_status || "",
              manager_skipped_rejected_reason:
                item?.manager_skipped_rejected_reason || "",
              customer_interview_status: item?.customer_interview_status || "",
              customer_interview_skipped_rejected_reason:
                item?.customer_interview_skipped_rejected_reason || "",
              candidate_selected_date: toDateInput(
                item?.candidate_selected_date
              ),
            }))
          : [];
        if (mapped.length === 0) {
          setCandidates([{ ...defaultCandidate }]);
          setInitialCandidates([]);
        } else {
          setCandidates(mapped);
          setInitialCandidates(mapped);
        }
      } catch (err) {
        console.error("Failed to load interviewed candidates", err);
      }
    };

    void load();
  }, [
    authToken,
    hclDemand.demand_id,
    initialRequirement?.unique_job_posting_id,
  ]);

  useEffect(() => {
    const uniqueId = initialRequirement?.unique_job_posting_id;
    if (!uniqueId) return;
    if (!hclDemand.demand_id.trim()) return;

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const toDateInput = (value?: string | null) => {
      if (!value) return "";
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const load = async () => {
      try {
        const url = new URL(
          `${apiBase}/api/optum-onboarding/${encodeURIComponent(uniqueId)}`
        );
        url.searchParams.set("demand_id", hclDemand.demand_id.trim());
        const res = await fetch(url.toString(), { headers });
        if (!res.ok) return;
        const data = await res.json();
        const next: OptumOnboardingFormState = {
          customer_employee_id: data?.customer_employee_id || "",
          sap_id: data?.sap_id || "",
          customer_onboarding_status: data?.customer_onboarding_status || "",
          customer_onboarded_date: toDateInput(data?.customer_onboarded_date),
          customer_employee_name: data?.customer_employee_name || "",
          customer_email: data?.customer_email || "",
          customer_login_id: data?.customer_login_id || "",
          customer_lob: data?.customer_lob || "",
          billing_start_date: toDateInput(data?.billing_start_date),
          customer_laptop_required: data?.customer_laptop_required || "",
          customer_laptop_status: data?.customer_laptop_status || "",
          customer_laptop_serial_no: data?.customer_laptop_serial_no || "",
        };
        setOptumOnboarding(next);
        setInitialOptumOnboarding(next);
      } catch (err) {
        console.error("Failed to load Optum onboarding status", err);
      }
    };

    void load();
  }, [
    authToken,
    hclDemand.demand_id,
    initialRequirement?.unique_job_posting_id,
  ]);

  useEffect(() => {
    const uniqueId = initialRequirement?.unique_job_posting_id;
    if (!uniqueId) return;

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const toDateInput = (value?: string | null) => {
      if (!value) return "";
      const match = value.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const load = async () => {
      try {
        const url = new URL(
          `${apiBase}/api/hcl-onboarding/${encodeURIComponent(uniqueId)}`
        );
        if (hclDemand.demand_id.trim()) {
          url.searchParams.set("demand_id", hclDemand.demand_id.trim());
        }
        const res = await fetch(url.toString(), { headers });
        if (!res.ok) return;
        const data = await res.json();
        const next: HclOnboardingFormState = {
          sap_id: data?.sap_id || "",
          candidate_contact: data?.candidate_contact || "",
          candidate_email: data?.candidate_email || "",
          hcl_onboarding_status: data?.hcl_onboarding_status || "",
          hire_loss_reason: data?.hire_loss_reason || "",
          onboarded_date: toDateInput(data?.onboarded_date),
          employee_name: data?.employee_name || "",
          employee_hcl_email: data?.employee_hcl_email || "",
        };
        setOnboarding(next);
        setInitialOnboarding(next);
      } catch (err) {
        console.error("Failed to load onboarding status", err);
      }
    };

    void load();
  }, [
    authToken,
    hclDemand.demand_id,
    initialRequirement?.unique_job_posting_id,
  ]);

  const handleHclChange = (patch: Partial<HclDemandFormState>) => {
    setHclDemand((prev) => ({ ...prev, ...patch }));
  };

  const hasHclChanges = (current: HclDemandFormState) => {
    const normalize = (
      val: string | HclDemandFormState[keyof HclDemandFormState]
    ) => (typeof val === "string" ? val.trim() : val);
    return (Object.keys(current) as Array<keyof HclDemandFormState>).some(
      (key) => normalize(current[key]) !== normalize(initialHclDemand[key])
    );
  };

  const normalizedCandidates = useMemo(() => {
    const normalize = (c: InterviewedCandidateFormState) => ({
      ...c,
      candidate_contact: c.candidate_contact.trim(),
      candidate_selected_date: c.candidate_selected_date || "",
    });
    const sorter = (
      a: InterviewedCandidateFormState,
      b: InterviewedCandidateFormState
    ) => a.candidate_contact.localeCompare(b.candidate_contact);
    return {
      current: [...candidates]
        .map(normalize)
        .filter((c) => c.candidate_contact)
        .sort(sorter),
      initial: [...initialCandidates]
        .map(normalize)
        .filter((c) => c.candidate_contact)
        .sort(sorter),
    };
  }, [candidates, initialCandidates]);

  const hasCandidateChanges = () => {
    const cur = normalizedCandidates.current;
    const init = normalizedCandidates.initial;
    if (cur.length !== init.length) return true;
    return cur.some(
      (c, idx) => JSON.stringify(c) !== JSON.stringify(init[idx])
    );
  };

  const hasOnboardingChanges = () => {
    const normalize = (o: HclOnboardingFormState) => ({
      ...o,
      sap_id: o.sap_id.trim(),
      candidate_contact: o.candidate_contact.trim(),
      candidate_email: o.candidate_email.trim(),
      hcl_onboarding_status: o.hcl_onboarding_status.trim(),
      hire_loss_reason: o.hire_loss_reason.trim(),
      onboarded_date: o.onboarded_date || "",
      employee_name: o.employee_name.trim(),
      employee_hcl_email: o.employee_hcl_email.trim(),
    });
    const cur = normalize(onboarding);
    const init = normalize(initialOnboarding);
    return JSON.stringify(cur) !== JSON.stringify(init);
  };

  const hasOptumOnboardingChanges = () => {
    const normalize = (o: OptumOnboardingFormState) => ({
      ...o,
      customer_employee_id: o.customer_employee_id.trim(),
      sap_id: o.sap_id.trim(),
      customer_onboarding_status: o.customer_onboarding_status.trim(),
      customer_onboarded_date: o.customer_onboarded_date || "",
      customer_employee_name: o.customer_employee_name.trim(),
      customer_email: o.customer_email.trim(),
      customer_login_id: o.customer_login_id.trim(),
      customer_lob: o.customer_lob.trim(),
      billing_start_date: o.billing_start_date || "",
      customer_laptop_required: o.customer_laptop_required.trim(),
      customer_laptop_status: o.customer_laptop_status.trim(),
      customer_laptop_serial_no: o.customer_laptop_serial_no.trim(),
    });
    const cur = normalize(optumOnboarding);
    const init = normalize(initialOptumOnboarding);
    return JSON.stringify(cur) !== JSON.stringify(init);
  };

  const handleCombinedUpdate = async (
    customerPayload: Partial<CustomerRequirementRecord>
  ) => {
    if (viewOnly) return;
    if (!authToken) {
      throw new Error("You must be signed in to update.");
    }
    const uniqueId = initialRequirement?.unique_job_posting_id;
    if (!uniqueId) {
      throw new Error("Missing unique job posting id for update.");
    }

    const customerHasChanges = Object.keys(customerPayload).length > 0;
    const hclHasChanges = hasHclChanges(hclDemand);
    const candidateHasChanges = hasCandidateChanges();
    const onboardingHasChanges = hasOnboardingChanges();
    const optumOnboardingHasChanges = hasOptumOnboardingChanges();

    if (
      !customerHasChanges &&
      !hclHasChanges &&
      !candidateHasChanges &&
      !onboardingHasChanges &&
      !optumOnboardingHasChanges
    ) {
      alert("No changes to update.");
      return;
    }

    if (hclHasChanges && !hclDemand.demand_id.trim()) {
      throw new Error("Demand ID is required to save HCL demand.");
    }

    if (candidateHasChanges && !hclDemand.demand_id.trim()) {
      throw new Error("Demand ID is required to save interviewed candidates.");
    }

    const shouldSaveOnboarding =
      onboardingHasChanges &&
      onboarding.sap_id.trim() &&
      onboarding.candidate_contact.trim();

    if (onboardingHasChanges && !shouldSaveOnboarding) {
      throw new Error(
        "SAP ID and candidate contact are required to save onboarding status."
      );
    }

    const shouldSaveOptumOnboarding =
      optumOnboardingHasChanges &&
      hclDemand.demand_id.trim() &&
      optumOnboarding.customer_employee_id.trim() &&
      optumOnboarding.sap_id.trim();

    if (optumOnboardingHasChanges && !hclDemand.demand_id.trim()) {
      throw new Error("Demand ID is required to save Optum onboarding.");
    }

    if (optumOnboardingHasChanges && !shouldSaveOptumOnboarding) {
      throw new Error(
        "Customer employee ID and SAP ID are required to save Optum onboarding."
      );
    }

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    setUpdating(true);
    try {
      // Update customer requirement
      if (customerHasChanges) {
        const customerRes = await fetch(
          `${apiBase}/api/customer-requirements/${encodeURIComponent(
            uniqueId
          )}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(customerPayload),
          }
        );
        if (!customerRes.ok) {
          const body = await customerRes.json().catch(() => ({}));
          throw new Error(
            body.detail ||
              customerRes.statusText ||
              "Failed to update customer requirement"
          );
        }
      }

      // Upsert HCL demand
      if (hclHasChanges) {
        const hclPayload = {
          unique_job_posting_id: uniqueId,
          demand_id: hclDemand.demand_id.trim(),
          tag_spoc: hclDemand.tag_spoc || null,
          tsc_spoc: hclDemand.tsc_spoc || null,
          demand_created_date: hclDemand.demand_created_date || null,
          demand_status: hclDemand.demand_status || null,
          demand_approved_date: hclDemand.demand_approved_date || null,
          tag_first_profile_sourced_date:
            hclDemand.tag_first_profile_sourced_date || null,
          tsc_first_profile_sourced_date:
            hclDemand.tsc_first_profile_sourced_date || null,
          tp_profiles_requested:
            hclDemand.tp_profiles_requested === "Yes" ? 1 : 0,
          tp_vendor_name: hclDemand.tp_vendor_name || null,
          tp_profiles_requested_date:
            hclDemand.tp_profiles_requested_date || null,
          tp_first_profile_sourced_date:
            hclDemand.tp_first_profile_sourced_date || null,
          created_by: currentUser || undefined,
          modified_by: currentUser || undefined,
        };

        const hclRes = await fetch(
          `${apiBase}/api/hcl-demand/${encodeURIComponent(
            hclPayload.demand_id
          )}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(hclPayload),
          }
        );
        if (!hclRes.ok) {
          const body = await hclRes.json().catch(() => ({}));
          throw new Error(
            body.detail || hclRes.statusText || "Failed to save HCL demand"
          );
        }
      }

      if (candidateHasChanges) {
        const candidatePayload = {
          unique_job_posting_id: uniqueId,
          demand_id: hclDemand.demand_id.trim(),
          records: candidates
            .filter((c) => c.candidate_contact.trim())
            .map((c) => ({
              candidate_contact: c.candidate_contact.trim(),
              candidate_name: c.candidate_name || null,
              candidate_email: c.candidate_email || null,
              candidate_type: c.candidate_type || null,
              tp_vendor_name: c.tp_vendor_name || null,
              interview_status: c.interview_status || null,
              initial_screening_status: c.initial_screening_status || null,
              initial_screening_rejected_reason:
                c.initial_screening_rejected_reason || null,
              tp1_interview_status: c.tp1_interview_status || null,
              tp1_rejected_reason: c.tp1_rejected_reason || null,
              tp2_interview_status: c.tp2_interview_status || null,
              tp2_skipped_rejected_reason:
                c.tp2_skipped_rejected_reason || null,
              manager_interview_status: c.manager_interview_status || null,
              manager_skipped_rejected_reason:
                c.manager_skipped_rejected_reason || null,
              customer_interview_status: c.customer_interview_status || null,
              customer_interview_skipped_rejected_reason:
                c.customer_interview_skipped_rejected_reason || null,
              candidate_selected_date: c.candidate_selected_date || null,
              created_by: currentUser || undefined,
              modified_by: currentUser || undefined,
            })),
        };

        if (candidatePayload.records.length === 0) {
          throw new Error(
            "At least one interviewed candidate contact is required."
          );
        }

        const candRes = await fetch(
          `${apiBase}/api/interviewed-candidates/bulk`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(candidatePayload),
          }
        );

        if (!candRes.ok) {
          const body = await candRes.json().catch(() => ({}));
          throw new Error(
            body.detail ||
              candRes.statusText ||
              "Failed to save interviewed candidates"
          );
        }
        // refresh baseline after success
        setInitialCandidates(candidates.map((c) => ({ ...c })));
      }

      if (shouldSaveOnboarding) {
        const onboardingPayload = {
          ...onboarding,
          unique_job_posting_id: uniqueId,
          demand_id: hclDemand.demand_id.trim(),
        };

        const onboardingRes = await fetch(
          `${apiBase}/api/hcl-onboarding/${encodeURIComponent(uniqueId)}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(onboardingPayload),
          }
        );

        if (!onboardingRes.ok) {
          const body = await onboardingRes.json().catch(() => ({}));
          throw new Error(
            body.detail ||
              onboardingRes.statusText ||
              "Failed to save HCL onboarding"
          );
        }

        setInitialOnboarding({ ...onboarding });
      }

      if (shouldSaveOptumOnboarding) {
        const optumPayload = {
          ...optumOnboarding,
          unique_job_posting_id: uniqueId,
          demand_id: hclDemand.demand_id.trim(),
          created_by: currentUser || undefined,
          modified_by: currentUser || undefined,
        };

        const optumRes = await fetch(
          `${apiBase}/api/optum-onboarding/${encodeURIComponent(uniqueId)}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(optumPayload),
          }
        );

        if (!optumRes.ok) {
          const body = await optumRes.json().catch(() => ({}));
          throw new Error(
            body.detail ||
              optumRes.statusText ||
              "Failed to save Optum onboarding"
          );
        }

        setInitialOptumOnboarding({ ...optumOnboarding });
      }

      const updatedParts = [
        customerHasChanges ? "customer requirement" : null,
        hclHasChanges ? "HCL demand" : null,
        candidateHasChanges ? "interviewed candidates" : null,
        shouldSaveOnboarding ? "HCL onboarding" : null,
        shouldSaveOptumOnboarding ? "Optum onboarding" : null,
      ].filter(Boolean);
      if (updatedParts.length > 0) {
        alert(`Updated ${updatedParts.join(" and ")}.`);
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      <AccordionItem
        title="Customer Requirement"
        isOpen={openSections.customer}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            customer: !prev.customer,
          }))
        }
      >
        {viewOnly ? (
          <DisplayGrid
            fields={[
              {
                label: "Unique Job Posting ID",
                value: initialRequirement?.unique_job_posting_id,
              },
              {
                label: "Job Posting ID",
                value: initialRequirement?.job_posting_id,
              },
              { label: "Portfolio", value: initialRequirement?.portfolio },
              {
                label: "Sub Portfolio",
                value: initialRequirement?.sub_portfolio,
              },
              { label: "Tower", value: initialRequirement?.tower },
              { label: "Location", value: initialRequirement?.location },
              {
                label: "Sub Location",
                value: initialRequirement?.sub_location,
              },
              {
                label: "Requirement Type",
                value: initialRequirement?.requirement_type,
              },
              {
                label: "Business Unit",
                value: initialRequirement?.business_unit,
              },
              {
                label: "Customer Job Posting Date",
                value: initialRequirement?.customer_job_posting_date,
              },
              {
                label: "Number of Positions",
                value: initialRequirement?.number_of_positions,
              },
              { label: "Sell Rate", value: initialRequirement?.sell_rate },
              {
                label: "Job Posting Status",
                value: initialRequirement?.job_posting_status,
              },
              { label: "Job Role", value: initialRequirement?.job_role },
              {
                label: "Skill Category",
                value: initialRequirement?.skill_category,
              },
              {
                label: "Primary Skills",
                value: initialRequirement?.primary_skills,
              },
              {
                label: "Secondary Skills",
                value: initialRequirement?.secondary_skills,
              },
              {
                label: "Customer CIO",
                value: initialRequirement?.customer_cio,
              },
              {
                label: "Customer Leader",
                value: initialRequirement?.customer_leader,
              },
              {
                label: "Customer VP",
                value: initialRequirement?.customer_vice_president,
              },
              {
                label: "Customer Senior Director",
                value: initialRequirement?.customer_senior_director,
              },
              {
                label: "Customer Director",
                value: initialRequirement?.customer_director,
              },
              {
                label: "Customer Hiring Manager",
                value: initialRequirement?.customer_hiring_manager,
              },
              {
                label: "Customer Band",
                value: initialRequirement?.customer_band,
              },
              { label: "HCL Leader", value: initialRequirement?.hcl_leader },
              {
                label: "HCL Deliver SPOC",
                value: initialRequirement?.hcl_deliver_spoc,
              },
              { label: "Created At", value: initialRequirement?.created_at },
              { label: "Updated At", value: initialRequirement?.updated_at },
              { label: "Created By", value: initialRequirement?.created_by },
              { label: "Modified By", value: initialRequirement?.modified_by },
            ]}
          />
        ) : (
          <CustomerRequirementForm
            initialRecord={initialRequirement}
            authToken={authToken}
            currentUser={currentUser ?? undefined}
            formId={formId}
            onUpdateRequest={handleCombinedUpdate}
          />
        )}
      </AccordionItem>

      <AccordionItem
        title="HCL Demand"
        isOpen={openSections.hcl}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            hcl: !prev.hcl,
          }))
        }
      >
        {viewOnly ? (
          <DisplayGrid
            fields={[
              { label: "Demand ID", value: hclDemand.demand_id },
              { label: "TAG SPOC", value: hclDemand.tag_spoc },
              { label: "TSC SPOC", value: hclDemand.tsc_spoc },
              {
                label: "Demand Created Date",
                value: hclDemand.demand_created_date,
              },
              { label: "Demand Status", value: hclDemand.demand_status },
              {
                label: "Demand Approved Date",
                value: hclDemand.demand_approved_date,
              },
              {
                label: "TAG First Profile Sourced Date",
                value: hclDemand.tag_first_profile_sourced_date,
              },
              {
                label: "TSC First Profile Sourced Date",
                value: hclDemand.tsc_first_profile_sourced_date,
              },
              {
                label: "TP Profiles Requested",
                value: hclDemand.tp_profiles_requested,
              },
              { label: "TP Vendor Name", value: hclDemand.tp_vendor_name },
              {
                label: "TP Profiles Requested Date",
                value: hclDemand.tp_profiles_requested_date,
              },
              {
                label: "TP First Profile Sourced Date",
                value: hclDemand.tp_first_profile_sourced_date,
              },
            ]}
          />
        ) : (
          <HclDemand value={hclDemand} onChange={handleHclChange} />
        )}
      </AccordionItem>

      {isEditMode && (
        <AccordionItem
          title="Interviewed Candidate Details"
          isOpen={openSections.candidates}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              candidates: !prev.candidates,
            }))
          }
        >
          {viewOnly ? (
            <div className="space-y-3">
              {candidates.length === 0 && (
                <p className="text-sm text-slate-500">
                  No interviewed candidates.
                </p>
              )}
              {candidates.map((c) => (
                <div
                  key={c.candidate_contact || Math.random()}
                  className="space-y-2 rounded-lg border border-slate-200 bg-white/70 p-3 shadow-sm"
                >
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Contact:
                      </span>{" "}
                      {c.candidate_contact || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Name:
                      </span>{" "}
                      {c.candidate_name || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Email:
                      </span>{" "}
                      {c.candidate_email || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Type:
                      </span>{" "}
                      {c.candidate_type || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        TP Vendor:
                      </span>{" "}
                      {c.tp_vendor_name || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Interview Status:
                      </span>{" "}
                      {c.interview_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Initial Screening:
                      </span>{" "}
                      {c.initial_screening_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Initial Rejected Reason:
                      </span>{" "}
                      {c.initial_screening_rejected_reason || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        TP1 Status:
                      </span>{" "}
                      {c.tp1_interview_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        TP1 Rejected Reason:
                      </span>{" "}
                      {c.tp1_rejected_reason || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        TP2 Status:
                      </span>{" "}
                      {c.tp2_interview_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        TP2 Skipped/Rejected Reason:
                      </span>{" "}
                      {c.tp2_skipped_rejected_reason || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Manager Status:
                      </span>{" "}
                      {c.manager_interview_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Manager Skipped/Rejected Reason:
                      </span>{" "}
                      {c.manager_skipped_rejected_reason || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Customer Status:
                      </span>{" "}
                      {c.customer_interview_status || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Customer Skipped/Rejected Reason:
                      </span>{" "}
                      {c.customer_interview_skipped_rejected_reason || "—"}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-slate-600">
                        Candidate Selected Date:
                      </span>{" "}
                      {c.candidate_selected_date || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <InterviewedCandidateDetail
              value={candidates}
              onChange={setCandidates}
            />
          )}
        </AccordionItem>
      )}

      {isEditMode && (
        <AccordionItem
          title="HCL Onboarding Status"
          isOpen={openSections.onboarding}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              onboarding: !prev.onboarding,
            }))
          }
        >
          {viewOnly ? (
            <DisplayGrid
              fields={[
                { label: "SAP ID", value: onboarding.sap_id },
                {
                  label: "Candidate Contact",
                  value: onboarding.candidate_contact,
                },
                { label: "Candidate Email", value: onboarding.candidate_email },
                {
                  label: "Onboarding Status",
                  value: onboarding.hcl_onboarding_status,
                },
                {
                  label: "Hire/Loss Reason",
                  value: onboarding.hire_loss_reason,
                },
                { label: "Onboarded Date", value: onboarding.onboarded_date },
                { label: "Employee Name", value: onboarding.employee_name },
                {
                  label: "Employee HCL Email",
                  value: onboarding.employee_hcl_email,
                },
              ]}
            />
          ) : (
            <HclOnboardingStatus
              value={onboarding}
              onChange={(patch) =>
                setOnboarding((prev) => ({
                  ...prev,
                  ...patch,
                }))
              }
            />
          )}
        </AccordionItem>
      )}

      {isEditMode && (
        <AccordionItem
          title="Optum Onboarding Status"
          isOpen={openSections.optumOnboarding}
          onToggle={() =>
            setOpenSections((prev) => ({
              ...prev,
              optumOnboarding: !prev.optumOnboarding,
            }))
          }
        >
          {viewOnly ? (
            <DisplayGrid
              fields={[
                {
                  label: "Customer Employee ID",
                  value: optumOnboarding.customer_employee_id,
                },
                { label: "SAP ID", value: optumOnboarding.sap_id },
                {
                  label: "Customer Onboarding Status",
                  value: optumOnboarding.customer_onboarding_status,
                },
                {
                  label: "Customer Onboarded Date",
                  value: optumOnboarding.customer_onboarded_date,
                },
                {
                  label: "Customer Employee Name",
                  value: optumOnboarding.customer_employee_name,
                },
                {
                  label: "Customer Email",
                  value: optumOnboarding.customer_email,
                },
                {
                  label: "Customer Login ID",
                  value: optumOnboarding.customer_login_id,
                },
                { label: "Customer LOB", value: optumOnboarding.customer_lob },
                {
                  label: "Billing Start Date",
                  value: optumOnboarding.billing_start_date,
                },
                {
                  label: "Laptop Required",
                  value: optumOnboarding.customer_laptop_required,
                },
                {
                  label: "Laptop Status",
                  value: optumOnboarding.customer_laptop_status,
                },
                {
                  label: "Laptop Serial No",
                  value: optumOnboarding.customer_laptop_serial_no,
                },
              ]}
            />
          ) : (
            <OptumOnboardingStatus
              value={optumOnboarding}
              onChange={(patch) =>
                setOptumOnboarding((prev) => ({
                  ...prev,
                  ...patch,
                }))
              }
            />
          )}
        </AccordionItem>
      )}

      {isEditMode && !viewOnly && (
        <div className="flex justify-end">
          <button
            type="submit"
            form={formId}
            disabled={updating}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {updating ? "Updating..." : "Update"}
          </button>
        </div>
      )}
    </div>
  );
};

export default JobPosting;
