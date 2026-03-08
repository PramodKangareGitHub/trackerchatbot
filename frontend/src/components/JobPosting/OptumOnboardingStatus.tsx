import React, { useState } from "react";

export type OptumOnboardingFormState = {
  customer_employee_id: string;
  sap_id: string;
  customer_onboarding_status: string;
  customer_onboarded_date: string;
  customer_employee_name: string;
  customer_email: string;
  customer_login_id: string;
  customer_lob: string;
  billing_start_date: string;
  customer_laptop_required: string;
  customer_laptop_status: string;
  customer_laptop_serial_no: string;
};

export type OptumOnboardingStatusProps = {
  value: OptumOnboardingFormState;
  onChange: (patch: Partial<OptumOnboardingFormState>) => void;
};

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const OptumOnboardingStatus: React.FC<OptumOnboardingStatusProps> = ({
  value,
  onChange,
}) => {
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });

  const handleStatusChange = (next: string) => {
    if (next === "Onboarded") {
      const missing: string[] = [];
      if (!value.customer_employee_id.trim())
        missing.push("Customer Employee ID");
      if (!value.customer_onboarded_date.trim())
        missing.push("Customer Onboarded Date");
      if (missing.length) {
        setStatusModal({
          open: true,
          message: "To mark Onboarded, please fill: " + missing.join(", "),
        });
        return;
      }
    }
    onChange({ customer_onboarding_status: next });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">
            Customer Employee ID
          </span>
          <input
            className={inputClasses}
            value={value.customer_employee_id}
            onChange={(e) => onChange({ customer_employee_id: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">SAP ID*</span>
          <input
            className={inputClasses}
            value={value.sap_id}
            onChange={(e) => onChange({ sap_id: e.target.value })}
            required
            disabled
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarding Status</span>
          <select
            className={inputClasses}
            value={value.customer_onboarding_status || "InProgress"}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            <option value="InProgress">InProgress</option>
            <option value="Onboarded">Onboarded</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Onboarded Date</span>
          <input
            type="date"
            className={inputClasses}
            value={value.customer_onboarded_date}
            onChange={(e) =>
              onChange({ customer_onboarded_date: e.target.value })
            }
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Employee Name</span>
          <input
            className={inputClasses}
            value={value.customer_employee_name}
            onChange={(e) =>
              onChange({ customer_employee_name: e.target.value })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Employee Email</span>
          <input
            className={inputClasses}
            value={value.customer_email}
            onChange={(e) => onChange({ customer_email: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Login ID</span>
          <input
            className={inputClasses}
            value={value.customer_login_id}
            onChange={(e) => onChange({ customer_login_id: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Line of Business</span>
          <input
            className={inputClasses}
            value={value.customer_lob}
            onChange={(e) => onChange({ customer_lob: e.target.value })}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Billing Start Date</span>
          <input
            type="date"
            className={inputClasses}
            value={value.billing_start_date}
            onChange={(e) => onChange({ billing_start_date: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Laptop Required</span>
          <input
            className={inputClasses}
            value={value.customer_laptop_required}
            onChange={(e) =>
              onChange({ customer_laptop_required: e.target.value })
            }
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Laptop Status</span>
          <select
            className={inputClasses}
            value={value.customer_laptop_status || ""}
            onChange={(e) =>
              onChange({ customer_laptop_status: e.target.value })
            }
          >
            <option value="">---Select Status---</option>
            <option value="Using VDI. No need Customer Laptop">
              Using VDI. No need Customer Laptop
            </option>
            <option value="New Laptop request raised">
              New Laptop request raised
            </option>
            <option value="Sent for business approval">
              Sent for business approval
            </option>
            <option value="Sent for adding to Intune">
              Sent for adding to Intune
            </option>
            <option value="Customer Image Installed">
              Customer Image Installed
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Laptop Serial No.</span>
          <input
            className={inputClasses}
            value={value.customer_laptop_serial_no}
            onChange={(e) =>
              onChange({ customer_laptop_serial_no: e.target.value })
            }
          />
        </label>
      </div>

      {statusModal.open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 text-base font-semibold text-slate-900">
              {statusModal.message}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-sky-700"
                onClick={() => setStatusModal({ open: false, message: "" })}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptumOnboardingStatus;
