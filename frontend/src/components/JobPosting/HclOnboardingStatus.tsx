import React, { useEffect, useState } from "react";

export type HclOnboardingFormState = {
  sap_id: string;
  candidate_contact: string;
  candidate_email: string;
  hcl_onboarding_status: string;
  hire_loss_reason: string;
  onboarded_date: string;
  employee_name: string;
  employee_hcl_email: string;
};

export type HclOnboardingStatusProps = {
  value: HclOnboardingFormState;
  onChange: (patch: Partial<HclOnboardingFormState>) => void;
};

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const HclOnboardingStatus: React.FC<HclOnboardingStatusProps> = ({
  value,
  onChange,
}) => {
  const hireLossChecked = value.hcl_onboarding_status === "Hire Loss";
  const [confirmOnboardOpen, setConfirmOnboardOpen] = useState(false);
  const [confirmOnboardDate, setConfirmOnboardDate] = useState<string>("");
  const [confirmOnboardError, setConfirmOnboardError] = useState<string>("");
  const [sapAlertOpen, setSapAlertOpen] = useState(false);

  useEffect(() => {
    if (!value.hire_loss_reason) {
      onChange({ hire_loss_reason: "NA" });
    }
  }, [value.hire_loss_reason, onChange]);

  useEffect(() => {
    if (!value.hcl_onboarding_status) {
      onChange({ hcl_onboarding_status: "InProgress" });
    }
  }, [value.hcl_onboarding_status, onChange]);

  const applyStatusChange = (status: string, onboardedDate?: string) => {
    const isHireLoss = status === "Hire Loss";
    onChange({
      hcl_onboarding_status: status,
      onboarded_date:
        status === "Onboarded" ? (onboardedDate ?? value.onboarded_date) : "",
      hire_loss_reason: isHireLoss
        ? value.hire_loss_reason === "NA"
          ? ""
          : value.hire_loss_reason
        : "NA",
    });
  };

  const handleStatusChange = (status: string) => {
    if (status === "Onboarded" && !value.sap_id.trim()) {
      setSapAlertOpen(true);
      return;
    }

    if (status === "Onboarded") {
      setConfirmOnboardDate(value.onboarded_date || "");
      setConfirmOnboardError("");
      setConfirmOnboardOpen(true);
      return;
    }

    applyStatusChange(status);
  };

  const onboardingOptions = [
    { value: "InProgress", label: "InProgress" },
    { value: "Onboarded", label: "Onboarded" },
    { value: "Hire Loss", label: "Hire Loss" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">SAP ID</span>
          <input
            className={inputClasses}
            value={value.sap_id}
            onChange={(e) => onChange({ sap_id: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Candidate Contact*</span>
          <input
            className={inputClasses}
            value={value.candidate_contact}
            onChange={(e) => onChange({ candidate_contact: e.target.value })}
            disabled
            required
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Candidate Email</span>
          <input
            className={inputClasses}
            value={value.candidate_email}
            onChange={(e) => onChange({ candidate_email: e.target.value })}
            disabled
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarding Status</span>
          <select
            className={inputClasses}
            value={value.hcl_onboarding_status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={value.hcl_onboarding_status === "Onboarded"}
          >
            {onboardingOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Hire/Loss Reason</span>
          <textarea
            className={`${inputClasses} min-h-[80px]`}
            value={value.hire_loss_reason}
            onChange={(e) => onChange({ hire_loss_reason: e.target.value })}
            disabled={!hireLossChecked}
          />
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarded Date</span>
          <input
            type="date"
            className={inputClasses}
            value={value.onboarded_date}
            onChange={(e) => onChange({ onboarded_date: e.target.value })}
            disabled={value.hcl_onboarding_status !== "Onboarded"}
          />
        </label>
      </div>

      {confirmOnboardOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 text-base font-semibold text-slate-900">
              Are you sure you want to onboard?
            </div>

            <label className="mb-3 flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">
                Onboarded Date*
              </span>
              <input
                type="date"
                className={inputClasses}
                value={confirmOnboardDate}
                onChange={(e) => {
                  setConfirmOnboardDate(e.target.value);
                  setConfirmOnboardError("");
                }}
              />
              {confirmOnboardError && (
                <span className="text-xs font-semibold text-amber-700">
                  {confirmOnboardError}
                </span>
              )}
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setConfirmOnboardOpen(false)}
              >
                No
              </button>
              <button
                type="button"
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                onClick={() => {
                  if (!confirmOnboardDate.trim()) {
                    setConfirmOnboardError("Onboarded Date is required.");
                    return;
                  }
                  applyStatusChange("Onboarded", confirmOnboardDate);
                  setConfirmOnboardOpen(false);
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {sapAlertOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 text-base font-semibold text-slate-900">
              Please enter SAP ID before marking Onboarded.
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                onClick={() => setSapAlertOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Employee Name</span>
          <input
            className={inputClasses}
            value={value.employee_name}
            onChange={(e) => onChange({ employee_name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Employee HCL Email</span>
          <input
            className={inputClasses}
            value={value.employee_hcl_email}
            onChange={(e) => onChange({ employee_hcl_email: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
};

export default HclOnboardingStatus;
