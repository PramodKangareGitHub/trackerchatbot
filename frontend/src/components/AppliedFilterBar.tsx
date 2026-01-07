import { AppliedFilters } from "./FilterChips";

type Props = {
  applied: AppliedFilters;
  onRemove: (column: string, value?: string) => void;
};

const AppliedFilterBar = ({ applied, onRemove }: Props) => {
  const entries = Object.entries(applied);
  if (!entries.length) return null;

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
      {entries.map(([col, values]) => (
        <div
          key={col}
          className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-700"
        >
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {col}
          </span>
          {Array.from(values).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onRemove(col, value)}
              className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-100 dark:hover:bg-slate-500"
            >
              {value}
              <span aria-hidden>✕</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onRemove(col)}
            className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
            aria-label={`Remove filters for ${col}`}
          >
            Clear
          </button>
        </div>
      ))}
    </div>
  );
};

export default AppliedFilterBar;
