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
  const tagSpocOptions = ["Drashti", "Neha", "Radhika"];
  const tscSpocOptions = ["Keerthana"];
  const demandStatusOptions = [
    "New",
    "Pending approval for L4",
    "Pending approval from WPC SPOC",
    "Moved to TAG",
  ];
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
  const filteredTagSpocs = tagSpocOptions.filter((opt) =>
    opt.toLowerCase().includes((value.tag_spoc || "").toLowerCase())
  );
  const filteredTscSpocs = tscSpocOptions.filter((opt) =>
    opt.toLowerCase().includes((value.tsc_spoc || "").toLowerCase())
  );
  const filteredDemandStatuses = demandStatusOptions.filter((opt) =>
    opt.toLowerCase().includes((value.demand_status || "").toLowerCase())
  );
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showTagSpocSuggestions, setShowTagSpocSuggestions] = useState(false);
  const [showTscSpocSuggestions, setShowTscSpocSuggestions] = useState(false);
  const [showDemandStatusSuggestions, setShowDemandStatusSuggestions] =
    useState(false);

  return (
    <div className="grid gap-4 overflow-visible md:grid-cols-3">
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
        <div className="relative">
          <input
            type="text"
            value={value.tag_spoc}
            onChange={(e) => {
              onChange({ tag_spoc: e.target.value });
              setShowTagSpocSuggestions(true);
            }}
            onFocus={() => setShowTagSpocSuggestions(true)}
            onBlur={() =>
              setTimeout(() => setShowTagSpocSuggestions(false), 150)
            }
            className={inputClasses}
            autoComplete="off"
          />
          {showTagSpocSuggestions && filteredTagSpocs.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {filteredTagSpocs.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ tag_spoc: opt });
                    setShowTagSpocSuggestions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">TSC SPOC</label>
        <div className="relative">
          <input
            type="text"
            value={value.tsc_spoc}
            onChange={(e) => {
              onChange({ tsc_spoc: e.target.value });
              setShowTscSpocSuggestions(true);
            }}
            onFocus={() => setShowTscSpocSuggestions(true)}
            onBlur={() =>
              setTimeout(() => setShowTscSpocSuggestions(false), 150)
            }
            className={inputClasses}
            autoComplete="off"
          />
          {showTscSpocSuggestions && filteredTscSpocs.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {filteredTscSpocs.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ tsc_spoc: opt });
                    setShowTscSpocSuggestions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
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
      <div className="flex flex-col gap-1 overflow-visible md:col-span-3">
        <label className="text-sm font-semibold text-slate-700">
          Demand Status
        </label>
        <div className="relative">
          <input
            type="text"
            value={value.demand_status}
            onChange={(e) => {
              onChange({ demand_status: e.target.value });
              setShowDemandStatusSuggestions(true);
            }}
            onFocus={() => setShowDemandStatusSuggestions(true)}
            onBlur={() =>
              setTimeout(() => setShowDemandStatusSuggestions(false), 150)
            }
            className={inputClasses}
            autoComplete="off"
          />
          {showDemandStatusSuggestions && filteredDemandStatuses.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border border-slate-200 bg-white pb-2 shadow-2xl">
              {filteredDemandStatuses.map((opt) => (
                <button
                  type="button"
                  key={opt}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange({ demand_status: opt });
                    setShowDemandStatusSuggestions(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-100"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
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
