import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { getWizardSummary, submitWizard } from "./wizardApi";

const WizardSummary: React.FC = () => {
  const { sessionId } = useParams();
  const { session } = useWizard();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getWizardSummary(sessionId!)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleSubmit = async () => {
    setSubmitLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      await submitWizard(sessionId!);
      setSubmitSuccess("Job posting submitted successfully.");
      setTimeout(() => {
        navigate("/wizard/drafts");
      }, 1500);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/wizard/${sessionId}/step/5`);
  };

  if (loading) return <div>Loading summary...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Job Posting Summary</h2>
      <div className="bg-white rounded-xl shadow p-6 mb-4">
        {summary ? (
          <pre className="text-xs bg-slate-100 p-3 rounded">
            {JSON.stringify(summary, null, 2)}
          </pre>
        ) : (
          <div>No summary data.</div>
        )}
      </div>
      {submitError && <div className="text-red-600 mb-2">{submitError}</div>}
      {submitSuccess && (
        <div className="text-green-600 mb-2">{submitSuccess}</div>
      )}
      <div className="flex justify-between gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
          onClick={handleBack}
          disabled={submitLoading}
        >
          Back
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded bg-sky-600 text-white font-semibold hover:bg-sky-700"
          onClick={handleSubmit}
          disabled={submitLoading}
        >
          {submitLoading ? "Submitting..." : "Submit Job Posting"}
        </button>
      </div>
    </div>
  );
};

export default WizardSummary;
