import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CustomerRequirementForm, {
  CustomerRequirementRecord,
} from "../components/JobPosting/CustomerRequirementForm";

export type CustomerRequirementPageProps = {
  authToken: string | null;
  authUserEmail?: string | null;
};

const CustomerRequirementPage: React.FC<CustomerRequirementPageProps> = ({
  authToken,
  authUserEmail,
}) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSave = async (records: CustomerRequirementRecord[]) => {
    if (!authToken) {
      setError("You must be signed in to save.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/customer-requirements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(records),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText || "Failed to save");
      }
      const data = await res.json().catch(() => ({}));
      const inserted = data?.inserted ?? records.length;
      setSuccess(`Saved ${inserted} record(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            New Customer Requirement
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Unique IDs are generated as job_posting_id_1..N.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg border border-sky-600 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-sky-400 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800"
          >
            Go to Dashboard
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/30 dark:text-rose-100">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/30 dark:text-emerald-100">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <CustomerRequirementForm
          authToken={authToken}
          currentUser={authUserEmail || undefined}
          onSave={handleSave}
        />
        <div className="pt-4 text-right text-xs text-slate-500 dark:text-slate-400">
          {saving ? "Saving…" : null}
        </div>
      </div>
    </div>
  );
};

export default CustomerRequirementPage;
