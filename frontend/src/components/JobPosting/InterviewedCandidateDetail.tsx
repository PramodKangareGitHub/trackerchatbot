import React, { useMemo, useState } from "react";

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
};

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const InterviewedCandidateDetail: React.FC<InterviewedCandidateDetailProps> = ({
  value,
  onChange,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

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

  const activeCandidate =
    activeIndex === null ? null : (value[activeIndex] ?? null);

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
    setActiveIndex(next.length - 1);
  };

  const removeCandidate = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next.length ? next : [createBlank()]);
    if (activeIndex === idx) {
      setActiveIndex(null);
    } else if (activeIndex !== null && activeIndex > idx) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const closeSheet = () => setActiveIndex(null);

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
                  onClick={() =>
                    setActiveIndex(originalIndex === -1 ? idx : originalIndex)
                  }
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
              <button
                type="button"
                onClick={closeSheet}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 p-5">
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
                    Candidate Name
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
                    Candidate Email
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
                    Candidate Type
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.candidate_type}
                    onChange={(e) =>
                      setField(activeIndex, { candidate_type: e.target.value })
                    }
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP Vendor Name
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.tp_vendor_name}
                    onChange={(e) =>
                      setField(activeIndex, { tp_vendor_name: e.target.value })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Interview Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        interview_status: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Initial Screening Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.initial_screening_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        initial_screening_status: e.target.value,
                      })
                    }
                  />
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

              <div className="grid gap-3 md:grid-cols-2">
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
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP1 Interview Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.tp1_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp1_interview_status: e.target.value,
                      })
                    }
                  />
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
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    TP2 Interview Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.tp2_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        tp2_interview_status: e.target.value,
                      })
                    }
                  />
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
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Manager Interview Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.manager_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        manager_interview_status: e.target.value,
                      })
                    }
                  />
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
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-700">
                    Customer Interview Status
                  </span>
                  <input
                    className={inputClasses}
                    value={activeCandidate.customer_interview_status}
                    onChange={(e) =>
                      setField(activeIndex, {
                        customer_interview_status: e.target.value,
                      })
                    }
                  />
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
