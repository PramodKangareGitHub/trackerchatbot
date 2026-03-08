import React, { useEffect, useMemo, useState } from "react";

export type InterviewedCandidateFormState = {
  candidate_contact: string;
  candidate_name: string;
  candidate_email: string;
  candidate_type: string;
  tp_vendor_name: string;
  interview_status: string;
  initial_screening_status: string;
  initial_screening_rejected_reason: string;
  tp1_interview_status: string;
  tp1_rejected_reason: string;
  tp2_interview_status: string;
  tp2_skipped_rejected_reason: string;
  manager_interview_status: string;
  manager_skipped_rejected_reason: string;
  customer_interview_status: string;
  customer_interview_skipped_rejected_reason: string;
  candidate_selected_date: string;
};

export type InterviewedCandidateDetailProps = {
  value: InterviewedCandidateFormState[];
  onChange: (next: InterviewedCandidateFormState[]) => void;
  onOnboard?: (candidate: InterviewedCandidateFormState) => void;
};

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const initialScreeningStatuses = [
  { value: "", label: "---Select Status---" },
  { value: "InProgress", label: "InProgress" },
  { value: "Selected", label: "Selected" },
  { value: "Rejected", label: "Rejected" },
];

const interviewStatuses = [
  { value: "", label: "---Select Status---" },
  { value: "To be scheduled", label: "To be scheduled" },
  { value: "Scheduled", label: "Scheduled" },
  { value: "Selected", label: "Selected" },
  { value: "Rejected", label: "Rejected" },
];

const interviewStatusesWithSkipped = [
  ...interviewStatuses,
  { value: "Skipped", label: "Skipped" },
];

const tpVendorOptions = [
  "Devlabs",
  "Adenai",
  "3K Technologies",
  "Highbro Technologies",
];

const InterviewedCandidateDetail: React.FC<InterviewedCandidateDetailProps> = ({
  value,
  onChange,
  onOnboard,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showTpVendorSuggestions, setShowTpVendorSuggestions] = useState(false);
  const [candidateErrors, setCandidateErrors] = useState<string[]>([]);
  const [activeBackup, setActiveBackup] =
    useState<InterviewedCandidateFormState | null>(null);

  const createBlank = (): InterviewedCandidateFormState => ({
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
  });

  const sortedList = useMemo(() => {
    return [...value].sort((a, b) =>
      (a.candidate_contact || "").localeCompare(b.candidate_contact || "")
    );
  }, [value]);

  const filteredTpVendors = useMemo(() => {
    const term = (value[activeIndex ?? -1]?.tp_vendor_name || "").toLowerCase();
    return tpVendorOptions.filter((v) => v.toLowerCase().includes(term));
  }, [activeIndex, value]);

  const validateActiveCandidate = () => {
    if (!activeCandidate) return true;
    const name = activeCandidate.candidate_name.trim();
    const contact = activeCandidate.candidate_contact.trim();
    const email = activeCandidate.candidate_email.trim();
    const type = activeCandidate.candidate_type.trim();
    const isTp = activeCandidate.candidate_type === "TP";
    const vendorMissing = isTp && !activeCandidate.tp_vendor_name.trim();

    const errors: string[] = [];
    if (!name) errors.push("Candidate Name is required.");
    if (!contact) errors.push("Candidate Contact is required.");
    if (!email) errors.push("Candidate Email is required.");
    if (!type) errors.push("Candidate Type is required.");
    if (vendorMissing)
      errors.push("TP Vendor Name is required when Candidate Type is TP.");

    setCandidateErrors(errors);
    return errors.length === 0;
  };

  const activeCandidate =
    activeIndex === null ? null : (value[activeIndex] ?? null);

  const stageState = useMemo(() => {
    const val = (field: keyof InterviewedCandidateFormState): string =>
      (activeCandidate && activeCandidate[field]) || "";
    const isSelected = (status: string) =>
      status !== "" && status !== "---Select Status---";
    const isRejected = (status: string) => status === "Rejected";
    const canAdvance = (status: string) =>
      status === "Selected" || status === "Skipped";

    const initialStatus = val("initial_screening_status");
    const tp1Status = val("tp1_interview_status");
    const tp2Status = val("tp2_interview_status");
    const managerStatus = val("manager_interview_status");

    const tp1Enabled = canAdvance(initialStatus);
    const tp1Advanceable = canAdvance(tp1Status);

    const tp2Enabled = tp1Advanceable;
    const tp2Advanceable = canAdvance(tp2Status);

    const managerEnabled = tp2Advanceable;
    const managerAdvanceable = canAdvance(managerStatus);

    const customerEnabled = managerAdvanceable;

    return {
      tp1Enabled,
      tp2Enabled,
      managerEnabled,
      customerEnabled,
    };
  }, [activeCandidate]);

  useEffect(() => {
    if (!activeCandidate || activeIndex === null) return;

    const val = (field: keyof InterviewedCandidateFormState): string =>
      (activeCandidate && activeCandidate[field]) || "";
    const canAdvance = (status: string) =>
      status === "Selected" || status === "Skipped";

    const initialStatus = val("initial_screening_status");
    const tp1Status = val("tp1_interview_status");
    const tp2Status = val("tp2_interview_status");
    const managerStatus = val("manager_interview_status");

    const tp1Allowed = canAdvance(initialStatus);
    const tp2Allowed = tp1Allowed && canAdvance(tp1Status);
    const managerAllowed = tp2Allowed && canAdvance(tp2Status);
    const customerAllowed = managerAllowed && canAdvance(managerStatus);

    const updates: Partial<InterviewedCandidateFormState> = {};

    if (!tp1Allowed) {
      if (activeCandidate.tp1_interview_status)
        updates.tp1_interview_status = "";
      if (activeCandidate.tp1_rejected_reason) updates.tp1_rejected_reason = "";
    }

    if (!tp2Allowed) {
      if (activeCandidate.tp2_interview_status)
        updates.tp2_interview_status = "";
      if (activeCandidate.tp2_skipped_rejected_reason)
        updates.tp2_skipped_rejected_reason = "";
    }

    if (!managerAllowed) {
      if (activeCandidate.manager_interview_status)
        updates.manager_interview_status = "";
      if (activeCandidate.manager_skipped_rejected_reason)
        updates.manager_skipped_rejected_reason = "";
    }

    if (!customerAllowed) {
      if (activeCandidate.customer_interview_status)
        updates.customer_interview_status = "";
      if (activeCandidate.customer_interview_skipped_rejected_reason)
        updates.customer_interview_skipped_rejected_reason = "";
    }

    if (Object.keys(updates).length) {
      setField(activeIndex, updates);
    }
  }, [activeCandidate, activeIndex]);

  const reasonState = useMemo(() => {
    const val = (field: keyof InterviewedCandidateFormState): string =>
      (activeCandidate && activeCandidate[field]) || "";
    const shouldEnable = (status: string) =>
      status === "Skipped" || status === "Rejected";

    const initialStatus = val("initial_screening_status");
    const tp1Status = val("tp1_interview_status");
    const tp2Status = val("tp2_interview_status");
    const managerStatus = val("manager_interview_status");
    const customerStatus = val("customer_interview_status");

    return {
      initialReasonEnabled: shouldEnable(initialStatus),
      tp1ReasonEnabled: shouldEnable(tp1Status),
      tp2ReasonEnabled: shouldEnable(tp2Status),
      managerReasonEnabled: shouldEnable(managerStatus),
      customerReasonEnabled: shouldEnable(customerStatus),
    };
  }, [activeCandidate]);

  const derivedInterviewStatus = useMemo(() => {
    if (!activeCandidate) return "";
    const priority: Array<{
      field:
        | "customer_interview_status"
        | "manager_interview_status"
        | "tp2_interview_status"
        | "tp1_interview_status"
        | "initial_screening_status";
      label: string;
    }> = [
      {
        field: "customer_interview_status",
        label: "Customer Interview Status",
      },
      { field: "manager_interview_status", label: "Manager Interview Status" },
      { field: "tp2_interview_status", label: "TP2 Interview Status" },
      { field: "tp1_interview_status", label: "TP1 Interview Status" },
      { field: "initial_screening_status", label: "Initial Screening Status" },
    ];

    for (const item of priority) {
      const status = activeCandidate[item.field];
      if (status && status !== "---Select Status---" && status !== "Skipped") {
        return `${item.label} - ${status}`;
      }
    }
    return "";
  }, [activeCandidate]);

  useEffect(() => {
    if (
      activeCandidate &&
      activeIndex !== null &&
      activeCandidate.interview_status !== derivedInterviewStatus
    ) {
      setField(activeIndex, { interview_status: derivedInterviewStatus });
    }
  }, [activeCandidate, activeIndex, derivedInterviewStatus]);

  const onboardEnabled = useMemo(() => {
    if (!activeCandidate) return false;
    if (!activeCandidate.candidate_contact.trim()) return false;
    const initialStatus = activeCandidate.initial_screening_status;
    const tp1Status = activeCandidate.tp1_interview_status;
    const tp2Status = activeCandidate.tp2_interview_status;
    const managerStatus = activeCandidate.manager_interview_status;
    const customerStatus = activeCandidate.customer_interview_status;

    const isAllowed = (status: string) =>
      status === "" || status === "Selected" || status === "Skipped";

    if (!isAllowed(initialStatus)) return false;
    if (!isAllowed(tp1Status)) return false;
    if (!isAllowed(tp2Status)) return false;
    if (!isAllowed(managerStatus)) return false;
    if (!isAllowed(customerStatus)) return false;

    if (tp1Status !== "Selected") return false;

    return true;
  }, [activeCandidate]);

  const setField = (
    idx: number,
    patch: Partial<InterviewedCandidateFormState>
  ) => {
    const next = value.map((row, i) =>
      i === idx ? { ...row, ...patch } : row
    );
    onChange(next);
  };

  const addCandidate = () => {
    const next = [...value, createBlank()];
    onChange(next);
    const newIndex = next.length - 1;
    setActiveBackup({ ...createBlank() });
    setActiveIndex(newIndex);
    setCandidateErrors([]);
  };

  const removeCandidate = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    if (next.length === 0) {
      setActiveIndex(null);
      setCandidateErrors([]);
      setActiveBackup(null);
      return;
    }
    if (activeIndex === idx) {
      setActiveIndex(null);
      setCandidateErrors([]);
      setActiveBackup(null);
    } else if (activeIndex !== null && activeIndex > idx) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const closeSheet = () => {
    setActiveIndex(null);
    setCandidateErrors([]);
    setShowTpVendorSuggestions(false);
    setActiveBackup(null);
  };

  const cancelSheet = () => {
    if (activeIndex !== null && activeBackup) {
      const restored = value.map((row, i) =>
        i === activeIndex ? activeBackup : row
      );
      onChange(restored);
    }
    closeSheet();
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-800">Candidates</div>
        <button
          type="button"
          onClick={addCandidate}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
        >
          + Add
        </button>
      </div>

      <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {sortedList.length === 0 && (
          <div className="p-4 text-sm text-slate-600">No candidates yet.</div>
        )}
        {sortedList.map((row, idx) => {
          const originalIndex = value.findIndex(
            (v) => v.candidate_contact === row.candidate_contact
          );
          const badge =
            row.interview_status || row.customer_interview_status || "Pending";
          return (
            <div
              key={`${row.candidate_contact || "new"}-${idx}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {row.candidate_contact || "New candidate"}
                </div>
                <div className="truncate text-xs text-slate-600">
                  {row.candidate_name || "No name"}
                </div>
                <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                  {badge}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = originalIndex === -1 ? idx : originalIndex;
                    setActiveBackup({ ...(value[target] || row) });
                    setActiveIndex(target);
                    setCandidateErrors([]);
                  }}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    removeCandidate(originalIndex === -1 ? idx : originalIndex)
                  }
                  className="rounded border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {activeCandidate && activeIndex !== null && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Edit candidate
                </div>
                <div className="text-xs text-slate-600">
                  {activeCandidate.candidate_contact || "New candidate"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!onboardEnabled}
                  className={`rounded px-3 py-1.5 text-xs font-semibold text-white shadow ${
                    onboardEnabled
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-emerald-400 cursor-not-allowed opacity-80"
                  }`}
                  onClick={() => {
                    if (!onboardEnabled || !activeCandidate) return;
                    onOnboard?.(activeCandidate);
                    closeSheet();
                  }}
                >
                  Select for Onboarding
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  onClick={() => {
                    if (!validateActiveCandidate()) return;
                    closeSheet();
                  }}
                >
                  Save & Close
                </button>
                <button
                  type="button"
                  onClick={cancelSheet}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>

            <div className="space-y-3 p-5">
              {candidateErrors.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Please fix the following
                  </div>
                  <ul className="list-disc space-y-1 pl-4 text-xs font-semibold">
                    {candidateErrors.map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Candidate Contact*
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.candidate_contact}
                    onChange={(e) =>
                      setField(activeIndex, {
                        candidate_contact: e.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Candidate Name*
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.candidate_name}
                    onChange={(e) =>
                      setField(activeIndex, { candidate_name: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Candidate Email*
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.candidate_email}
                    onChange={(e) =>
                      setField(activeIndex, { candidate_email: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Candidate Type*
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.candidate_type}
                    onChange={(e) =>
                      setField(activeIndex, {
                        candidate_type: e.target.value,
                        ...(e.target.value !== "TP"
                          ? { tp_vendor_name: "" }
                          : {}),
                      })
                    }
                  >
                    <option value="">---Select Candidate Type---</option>
                    <option value="TSC">TSC</option>
                    <option value="TAG">TAG</option>
                    <option value="TP">TP</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP Vendor Name
                  </span>
                  <div className="relative">
                    <input
                      className={inputClasses}
                      value={activeCandidate.tp_vendor_name}
                      disabled={activeCandidate.candidate_type !== "TP"}
                      placeholder={
                        activeCandidate.candidate_type === "TP"
                          ? "Start typing to search vendors or enter a new one"
                          : "Enable by selecting Candidate Type = TP"
                      }
                      onChange={(e) => {
                        setField(activeIndex, {
                          tp_vendor_name: e.target.value,
                        });
                        setShowTpVendorSuggestions(true);
                      }}
                      onFocus={() =>
                        activeCandidate.candidate_type === "TP" &&
                        setShowTpVendorSuggestions(true)
                      }
                      onBlur={() =>
                        setTimeout(() => setShowTpVendorSuggestions(false), 150)
                      }
                    />
                    {activeCandidate.candidate_type === "TP" &&
                      showTpVendorSuggestions &&
                      filteredTpVendors.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          {filteredTpVendors.map((option) => (
                            <button
                              type="button"
                              key={option}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setField(activeIndex, {
                                  tp_vendor_name: option,
                                });
                                setShowTpVendorSuggestions(false);
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
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Candidate Selected Date
                  </span>
                  <input
                    type="date"
                    className={inputClasses}
                    value={activeCandidate.candidate_selected_date}
                    onChange={(e) =>
                      setField(activeIndex, {
                        candidate_selected_date: e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">
                  Interview Status
                </span>
                <input
                  className={inputClasses}
                  value={derivedInterviewStatus}
                  disabled
                  readOnly
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Initial Screening Status
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.initial_screening_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        initial_screening_status: e.target.value,
                      })
                    }
                  >
                    {initialScreeningStatuses.map((opt) => (
                      <option
                        key={opt.value || "placeholder"}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Initial Screening Rejected Reason
                  </span>
                  <textarea
                    className={`${inputClasses} min-h-[60px]`}
                    value={activeCandidate.initial_screening_rejected_reason}
                    onChange={(e) =>
                      setField(activeIndex, {
                        initial_screening_rejected_reason: e.target.value,
                      })
                    }
                    disabled={!reasonState.initialReasonEnabled}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP1 Interview Status
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.tp1_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp1_interview_status: e.target.value,
                      })
                    }
                    disabled={!stageState.tp1Enabled}
                  >
                    {interviewStatuses.map((opt) => (
                      <option
                        key={opt.value || "placeholder"}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP1 Rejected Reason
                  </span>
                  <textarea
                    className={`${inputClasses} min-h-[60px]`}
                    value={activeCandidate.tp1_rejected_reason}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp1_rejected_reason: e.target.value,
                      })
                    }
                    disabled={!reasonState.tp1ReasonEnabled}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP2 Interview Status
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.tp2_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp2_interview_status: e.target.value,
                      })
                    }
                    disabled={!stageState.tp2Enabled}
                  >
                    {interviewStatusesWithSkipped.map((opt) => (
                      <option
                        key={opt.value || "placeholder"}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP2 Skipped/Rejected Reason
                  </span>
                  <textarea
                    className={`${inputClasses} min-h-[60px]`}
                    value={activeCandidate.tp2_skipped_rejected_reason}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp2_skipped_rejected_reason: e.target.value,
                      })
                    }
                    disabled={!reasonState.tp2ReasonEnabled}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Manager Interview Status
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.manager_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        manager_interview_status: e.target.value,
                      })
                    }
                    disabled={!stageState.managerEnabled}
                  >
                    {interviewStatusesWithSkipped.map((opt) => (
                      <option
                        key={opt.value || "placeholder"}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Manager Skipped/Rejected Reason
                  </span>
                  <textarea
                    className={`${inputClasses} min-h-[60px]`}
                    value={activeCandidate.manager_skipped_rejected_reason}
                    onChange={(e) =>
                      setField(activeIndex, {
                        manager_skipped_rejected_reason: e.target.value,
                      })
                    }
                    disabled={!reasonState.managerReasonEnabled}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Customer Interview Status
                  </span>
                  <select
                    className={inputClasses}
                    value={activeCandidate.customer_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        customer_interview_status: e.target.value,
                      })
                    }
                    disabled={!stageState.customerEnabled}
                  >
                    {interviewStatusesWithSkipped.map((opt) => (
                      <option
                        key={opt.value || "placeholder"}
                        value={opt.value}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Customer Skipped/Rejected Reason
                  </span>
                  <textarea
                    className={`${inputClasses} min-h-[60px]`}
                    value={
                      activeCandidate.customer_interview_skipped_rejected_reason
                    }
                    onChange={(e) =>
                      setField(activeIndex, {
                        customer_interview_skipped_rejected_reason:
                          e.target.value,
                      })
                    }
                    disabled={!reasonState.customerReasonEnabled}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewedCandidateDetail;
