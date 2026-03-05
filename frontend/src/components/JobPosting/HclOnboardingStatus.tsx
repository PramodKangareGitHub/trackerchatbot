import React, { useEffect, useId } from "react";

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
  const checkboxId = useId();
  const reasonLabelId = `${checkboxId}-label`;
  const hireLossChecked = value.hcl_onboarding_status === "Hire Loss";

  useEffect(() => {
    if (!value.hire_loss_reason) {
      onChange({ hire_loss_reason: "NA" });
    }
  }, [value.hire_loss_reason, onChange]);

  const handleHireLossToggle = (checked: boolean) => {
    if (checked) {
      onChange({
        hcl_onboarding_status: "Hire Loss",
        hire_loss_reason:
          value.hire_loss_reason === "NA" ? "" : value.hire_loss_reason,
      });
      return;
    }
    onChange({
      hcl_onboarding_status: "",
      hire_loss_reason: "NA",
    });
  };

  const handleStatusChange = (status: string) => {
    onChange({
      hcl_onboarding_status: status,
      onboarded_date: status === "Onboarded" ? value.onboarded_date : "",
    });
  };

  const onboardingOptions = [
    { value: "Selected", label: "Selected" },
    { value: "InProgress", label: "InProgress" },
    { value: "Onboarded", label: "Onboarded" },
    { value: "Hire Loss", label: "Hire Loss" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">SAP ID*</span>
          <input
            className={inputClasses}
            value={value.sap_id}
            onChange={(e) => onChange({ sap_id: e.target.value })}
            required
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
            disabled={hireLossChecked}
          >
            <option value="">---Select Status---</option>
            {onboardingOptions.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={
                  opt.value === "Hire Loss" ? !hireLossChecked : hireLossChecked
                }
              >
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1 text-sm">
          <label
            htmlFor={checkboxId}
            className="font-medium text-slate-700 flex items-center gap-2 cursor-pointer select-none"
          >
            <input
              id={checkboxId}
              type="checkbox"
              aria-label="Hire Loss"
              checked={hireLossChecked}
              onChange={(e) => handleHireLossToggle(e.target.checked)}
            />
            <span id={reasonLabelId}>Hire/Loss Reason</span>
          </label>
          <textarea
            className={`${inputClasses} min-h-[80px]`}
            value={value.hire_loss_reason}
            onChange={(e) => onChange({ hire_loss_reason: e.target.value })}
            disabled={!hireLossChecked}
            aria-labelledby={reasonLabelId}
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
