import React from "react";

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
        <input
          type="text"
          value={value.demand_status}
          onChange={(e) => onChange({ demand_status: e.target.value })}
          className={inputClasses}
        />
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
          value={value.tp_profiles_requested}
          onChange={(e) =>
            onChange({ tp_profiles_requested: e.target.value as "Yes" | "No" })
          }
          className={`${inputClasses} bg-white`}
        >
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-slate-700">
          TP Vendor Name
        </label>
        <input
          type="text"
          value={value.tp_vendor_name}
          onChange={(e) => onChange({ tp_vendor_name: e.target.value })}
          className={inputClasses}
        />
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
    </div>
  );
};

export default HclDemand;
