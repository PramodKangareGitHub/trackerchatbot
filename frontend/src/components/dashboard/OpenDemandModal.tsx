import React from "react";

export type HclOnboardingRow = {
  sap_id: string;
  unique_job_posting_id: string;
  demand_id: string;
  candidate_contact: string;
  candidate_email?: string | null;
  hcl_onboarding_status?: string | null;
  hire_loss_reason?: string | null;
  onboarded_date?: string | null;
  employee_name?: string | null;
  employee_hcl_email?: string | null;
};

export type OpenDemandModalProps = {
  open: boolean;
  rows: HclOnboardingRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  editingId: string | null;
  draft: HclOnboardingRow | null;
  onEdit: (row: HclOnboardingRow) => void;
  onChangeDraft: (patch: Partial<HclOnboardingRow>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
};

const OpenDemandModal: React.FC<OpenDemandModalProps> = ({
  open,
  rows,
  loading,
  error,
  onClose,
  editingId,
  draft,
  onEdit,
  onChangeDraft,
  onSave,
  onCancel,
  saving,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-[95%] max-w-[1600px] rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Open Demands
            </div>
            {error && (
              <div className="text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="p-4 text-sm text-slate-600 dark:text-slate-300">
              Loading…
            </div>
          ) : (
            <table className="min-w-full text-xs text-slate-800 dark:text-slate-100">
              <thead className="bg-slate-100 text-[11px] uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  {[
                    "Edit",
                    "Unique Job ID",
                    "SAP ID",
                    "Demand ID",
                    "Candidate Contact",
                    "Candidate Email",
                    "Status",
                    "Onboarded Date",
                    "Employee Name",
                    "Employee HCL Email",
                    "Hire/Loss Reason",
                  ].map((c) => (
                    <th key={c} className="px-3 py-2 text-left">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isEditing = editingId === row.unique_job_posting_id;
                  const active = isEditing && draft ? draft : row;
                  return (
                    <tr
                      key={row.unique_job_posting_id}
                      className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={onSave}
                              className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={onCancel}
                              className="rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="rounded border border-slate-200 p-1 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                            aria-label="Edit row"
                          >
                            <svg
                              aria-hidden
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              className="h-4 w-4"
                              fill="currentColor"
                            >
                              <path d="M13.586 3a2 2 0 0 1 1.414.586l1.414 1.414a2 2 0 0 1 0 2.828l-8.07 8.07a2 2 0 0 1-.878.506l-3.043.761a.5.5 0 0 1-.606-.606l.761-3.043a2 2 0 0 1 .506-.878l8.07-8.07A2 2 0 0 1 13.586 3Z" />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600 dark:text-slate-300">
                        {row.unique_job_posting_id}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.sap_id}
                            onChange={(e) =>
                              onChangeDraft({ sap_id: e.target.value })
                            }
                          />
                        ) : (
                          row.sap_id
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-600 dark:text-slate-300">
                        {row.demand_id}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.candidate_contact}
                            onChange={(e) =>
                              onChangeDraft({
                                candidate_contact: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.candidate_contact
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.candidate_email || ""}
                            onChange={(e) =>
                              onChangeDraft({ candidate_email: e.target.value })
                            }
                          />
                        ) : (
                          row.candidate_email || ""
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <select
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.hcl_onboarding_status || ""}
                            onChange={(e) =>
                              onChangeDraft({
                                hcl_onboarding_status: e.target.value,
                              })
                            }
                          >
                            <option value="">---Select Status---</option>
                            <option value="Selected">Selected</option>
                            <option value="InProgress">InProgress</option>
                            <option value="Onboarded">Onboarded</option>
                            <option value="Hire Loss">Hire Loss</option>
                          </select>
                        ) : (
                          row.hcl_onboarding_status || ""
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            type="date"
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.onboarded_date || ""}
                            onChange={(e) =>
                              onChangeDraft({ onboarded_date: e.target.value })
                            }
                            disabled={
                              active.hcl_onboarding_status !== "Onboarded"
                            }
                          />
                        ) : (
                          row.onboarded_date || ""
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.employee_name || ""}
                            onChange={(e) =>
                              onChangeDraft({ employee_name: e.target.value })
                            }
                          />
                        ) : (
                          row.employee_name || ""
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <input
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.employee_hcl_email || ""}
                            onChange={(e) =>
                              onChangeDraft({
                                employee_hcl_email: e.target.value,
                              })
                            }
                          />
                        ) : (
                          row.employee_hcl_email || ""
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {isEditing ? (
                          <textarea
                            className="w-full rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                            value={active.hire_loss_reason || ""}
                            onChange={(e) =>
                              onChangeDraft({
                                hire_loss_reason: e.target.value,
                              })
                            }
                            rows={2}
                          />
                        ) : (
                          row.hire_loss_reason || ""
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && !loading && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-4 text-center text-sm text-slate-600 dark:text-slate-300"
                    >
                      No InProgress onboarding records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default OpenDemandModal;
