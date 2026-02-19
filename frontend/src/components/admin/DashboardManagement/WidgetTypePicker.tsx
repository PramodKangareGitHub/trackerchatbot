import { Dispatch, SetStateAction } from "react";
import type { WidgetType } from "../types";

export type WidgetTypePickerProps = {
  show: boolean;
  pendingWidgetType: WidgetType;
  setPendingWidgetType: Dispatch<SetStateAction<WidgetType>>;
  setShowWidgetTypePicker: Dispatch<SetStateAction<boolean>>;
  confirmAddWidget: () => void;
};

const WidgetTypePicker = ({
  show,
  pendingWidgetType,
  setPendingWidgetType,
  setShowWidgetTypePicker,
  confirmAddWidget,
}: WidgetTypePickerProps) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
          Choose widget type
        </h4>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Start with the right layout for this widget.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setPendingWidgetType("table")}
            className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
              pendingWidgetType === "table"
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            }`}
          >
            <div className="text-base font-semibold">Table</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Pick fields and optional group by.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setPendingWidgetType("chart")}
            className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
              pendingWidgetType === "chart"
                ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-400 dark:bg-sky-900/40 dark:text-sky-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            }`}
          >
            <div className="text-base font-semibold">Chart</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Choose axes and chart type.
            </div>
          </button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowWidgetTypePicker(false)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmAddWidget}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetTypePicker;
