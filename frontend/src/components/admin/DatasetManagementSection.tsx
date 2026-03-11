import type { Dataset } from "./types";

export type DatasetManagementSectionProps = {
  datasets: Dataset[];
  datasetsLoading: boolean;
  actionLoading: boolean;
  onDeleteDataset: (id: string) => void;
  onClearAll: () => void;
};

const DatasetManagementSection = ({
  datasets,
  datasetsLoading,
  actionLoading,
  onDeleteDataset,
  onClearAll,
}: DatasetManagementSectionProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Dataset Management
        </h3>
        <button
          type="button"
          onClick={onClearAll}
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-100"
          disabled={actionLoading || datasetsLoading}
        >
          Clear All Datasets
        </button>
      </div>
      <div className="space-y-2 text-sm">
        {(datasetsLoading || actionLoading) && (
          <p className="text-slate-500 dark:text-slate-400">Loading…</p>
        )}
        {!datasetsLoading && !datasets.length && (
          <p className="text-slate-500 dark:text-slate-400">No datasets yet.</p>
        )}
        {!datasetsLoading && datasets.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {datasets.map((ds) => (
              <li
                key={ds.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {ds.original_file_name || ds.table_name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {ds.row_count} rows • {ds.columns.length} columns
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onDeleteDataset(ds.id)}
                    className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                    disabled={actionLoading}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default DatasetManagementSection;
