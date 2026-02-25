import React from "react";
import { useWizard } from "./WizardContext";

const steps = [
  "Customer Requirement",
  "HCL Resource Demand",
  "Interviewed Candidate",
  "HCL Onboarding Status",
  "Optum Onboarding Status",
];

export const WizardLayout: React.FC<{
  children: React.ReactNode;
  step: number;
  onBack?: () => void;
  onNext?: () => void;
  onSaveDraft?: () => void;
  isSubmitting?: boolean;
  disableNext?: boolean;
}> = ({
  children,
  step,
  onBack,
  onNext,
  onSaveDraft,
  isSubmitting,
  disableNext,
}) => {
  const { session } = useWizard();
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center mb-6">
        {steps.map((label, idx) => (
          <React.Fragment key={label}>
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 ${
                idx + 1 <= step
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-sky-600 border-sky-300"
              }`}
            >
              {idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className="flex-1 h-1 bg-sky-200 mx-2" />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow p-6 mb-4">{children}</div>
      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
          onClick={onBack}
          disabled={!onBack}
        >
          Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
            onClick={onSaveDraft}
            disabled={isSubmitting}
          >
            Save Draft
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-sky-600 text-white font-semibold hover:bg-sky-700"
            onClick={onNext}
            disabled={disableNext || isSubmitting}
          >
            {step === steps.length ? "Submit" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
};
