import React from "react";

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
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarding Status</span>
          <input
            className={inputClasses}
            value={value.hcl_onboarding_status}
            onChange={(e) =>
              onChange({ hcl_onboarding_status: e.target.value })
            }
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Hire/Loss Reason</span>
          <textarea
            className={`${inputClasses} min-h-[80px]`}
            value={value.hire_loss_reason}
            onChange={(e) => onChange({ hire_loss_reason: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarded Date</span>
          <input
            type="date"
            className={inputClasses}
            value={value.onboarded_date}
            onChange={(e) => onChange({ onboarded_date: e.target.value })}
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
