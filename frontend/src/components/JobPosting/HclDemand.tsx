import React, { useState } from "react";

export type HclDemandFormState = {
  demand_id: string;
  tag_spoc: string;
  tsc_spoc: string;
  demand_created_date: string;
  demand_status: string;
  demand_approved_date: string;
  tag_first_profile_sourced_date: string;
  tsc_first_profile_sourced_date: string;
  tp_profiles_requested: "Yes" | "No";
  tp_vendor_name: string;
  tp_profiles_requested_date: string;
  tp_first_profile_sourced_date: string;
};

export type HclDemandProps = {
  value: HclDemandFormState;
  onChange: (patch: Partial<HclDemandFormState>) => void;
};

const inputClasses =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const HclDemand: React.FC<HclDemandProps> = ({ value, onChange }) => {
  const tpRequestedYes = value.tp_profiles_requested === "Yes";
  const vendorOptions = [
    "Devlabs",
    "Adenai",
    "3K Technologies",
    "Highbro Technologies",
  ];
  const selectedVendors = value.tp_vendor_name
    ? value.tp_vendor_name
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];
  const [showVendorPicker, setShowVendorPicker] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          Demand ID
        </label>
        <input
          type="text"
          value={value.demand_id}
          onChange={(e) => onChange({ demand_id: e.target.value })}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">TAG SPOC</label>
        <input
          type="text"
          value={value.tag_spoc}
          onChange={(e) => onChange({ tag_spoc: e.target.value })}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">TSC SPOC</label>
        <input
          type="text"
          value={value.tsc_spoc}
          onChange={(e) => onChange({ tsc_spoc: e.target.value })}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          Demand Created Date
        </label>
        <input
          type="date"
          value={value.demand_created_date}
          onChange={(e) => onChange({ demand_created_date: e.target.value })}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          Demand Status
        </label>
        <select
          value={value.demand_status}
          onChange={(e) => onChange({ demand_status: e.target.value })}
          className={`${inputClasses} bg-white`}
        >
          <option value="">---Select Status---</option>
          <option value="New">New</option>
          <option value="Pending approval for L4">
            Pending approval for L4
          </option>
          <option value="Pending approval from WPC SPOC">
            Pending approval from WPC SPOC
          </option>
          <option value="Moved to TAG">Moved to TAG</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          Demand Approved Date
        </label>
        <input
          type="date"
          value={value.demand_approved_date}
          onChange={(e) => onChange({ demand_approved_date: e.target.value })}
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          TAG First Profile Sourced Date
        </label>
        <input
          type="date"
          value={value.tag_first_profile_sourced_date}
          onChange={(e) =>
            onChange({ tag_first_profile_sourced_date: e.target.value })
          }
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          TSC First Profile Sourced Date
        </label>
        <input
          type="date"
          value={value.tsc_first_profile_sourced_date}
          onChange={(e) =>
            onChange({ tsc_first_profile_sourced_date: e.target.value })
          }
          className={inputClasses}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          TP Profiles Requested
        </label>
        <select
          value={value.tp_profiles_requested || "No"}
          onChange={(e) => {
            const next = e.target.value as "Yes" | "No";
            onChange({
              tp_profiles_requested: next,
              ...(next === "No"
                ? {
                    tp_vendor_name: "",
                    tp_profiles_requested_date: "",
                    tp_first_profile_sourced_date: "",
                  }
                : {}),
            });
          }}
          className={`${inputClasses} bg-white`}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      {tpRequestedYes && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-700">
              TP Vendor Name
            </label>
            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <button
                type="button"
                onClick={() => setShowVendorPicker((s) => !s)}
                className="flex w-full items-center justify-between rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
              >
                <span>
                  {selectedVendors.length
                    ? selectedVendors.join(", ")
                    : "Select Vendors"}
                </span>
                <span aria-hidden className="text-slate-500">
                  {showVendorPicker ? "▴" : "▾"}
                </span>
              </button>
              {showVendorPicker && (
                <div className="mt-3 grid gap-2 rounded border border-slate-200 bg-slate-50 p-3">
                  {vendorOptions.map((v) => {
                    const checked = selectedVendors.includes(v);
                    return (
                      <label
                        key={v}
                        className="flex items-center gap-2 text-sm text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selectedVendors, v]
                              : selectedVendors.filter((item) => item !== v);
                            onChange({ tp_vendor_name: next.join(", ") });
                          }}
                        />
                        <span>{v}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-700">
              TP Profiles Requested Date
            </label>
            <input
              type="date"
              value={value.tp_profiles_requested_date}
              onChange={(e) =>
                onChange({ tp_profiles_requested_date: e.target.value })
              }
              className={inputClasses}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-slate-700">
              TP First Profile Sourced Date
            </label>
            <input
              type="date"
              value={value.tp_first_profile_sourced_date}
              onChange={(e) =>
                onChange({ tp_first_profile_sourced_date: e.target.value })
              }
              className={inputClasses}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default HclDemand;
