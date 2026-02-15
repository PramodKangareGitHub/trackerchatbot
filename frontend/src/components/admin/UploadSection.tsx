import type { Dispatch, SetStateAction } from "react";

export type UploadSectionProps = {
  uploadFile: File | null;
  setUploadFile: Dispatch<SetStateAction<File | null>>;
  onUpload: () => void;
  uploading: boolean;
};

const UploadSection = ({
  uploadFile,
  setUploadFile,
  onUpload,
  uploading,
}: UploadSectionProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Upload Excel
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          .xlsx or .xls
        </span>
      </div>
      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:gap-4">
        <label className="flex flex-1 cursor-pointer flex-col gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-slate-700 shadow-inner transition hover:border-sky-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <span className="font-medium">Choose file</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {uploadFile ? uploadFile.name : "Drop or pick an Excel file"}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setUploadFile(file ?? null);
            }}
          />
        </label>
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading}
          className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        After upload, the dataset becomes available for chat and record
        insertions.
      </p>
    </section>
  );
};

export default UploadSection;
