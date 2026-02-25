import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { WizardProvider } from "./WizardContext";
import WizardStep1 from "./WizardStep1";
import WizardStep2 from "./WizardStep2";
import WizardStep3 from "./WizardStep3";
import WizardStep4 from "./WizardStep4";
import WizardStep5 from "./WizardStep5";
import WizardSummary from "./WizardSummary";

import WizardTopBar from "./WizardTopBar";
import { AppTopBarProps } from "../App";
import { createWizardSession, listDrafts } from "./wizardApi";

type Draft = {
  id: string;
  status: string;
  updated_at?: string;
};

const WizardDraftsPage: React.FC<{ topBarProps?: AppTopBarProps }> = ({
  topBarProps,
}) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listDrafts()
      .then((res) => setDrafts(res || []))
      .catch((err) => setError(err?.message || "Failed to load drafts"))
      .finally(() => setLoading(false));
  }, []);

  const handleStartNew = async () => {
    setCreating(true);
    setError(null);
    try {
      const session = await createWizardSession();
      navigate(`/wizard/${session.id}/step/1`);
    } catch (err: any) {
      setError(err?.message || "Failed to start wizard");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex min-h-screen w-full flex-col px-3 py-8 md:px-4 lg:px-5">
        {topBarProps ? <WizardTopBar {...topBarProps} /> : null}
        <main className="mt-10 flex-1 space-y-4">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold mb-1">Job Posting Drafts</h2>
                <p className="text-sm text-slate-500">
                  Select a draft to resume or start a new wizard.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartNew}
                disabled={creating}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700 disabled:opacity-60"
              >
                {creating ? "Starting..." : "+ New Wizard"}
              </button>
            </div>
            <div className="mt-4 bg-white rounded-xl shadow">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">
                  Loading drafts...
                </div>
              ) : error ? (
                <div className="p-6 text-sm text-red-600">{error}</div>
              ) : drafts.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No drafts found.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {drafts.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Session {d.id}
                        </div>
                        <div className="text-xs text-slate-500">
                          Status: {d.status}
                        </div>
                        {d.updated_at && (
                          <div className="text-[11px] text-slate-400">
                            Updated: {new Date(d.updated_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-sky-600 hover:text-sky-700"
                        onClick={() => navigate(`/wizard/${d.id}/step/1`)}
                      >
                        Resume
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const WizardRouter: React.FC<{ topBarProps?: AppTopBarProps }> = ({
  topBarProps,
}) => {
  return (
    <WizardProvider>
      <Routes>
        <Route
          path="drafts"
          element={<WizardDraftsPage topBarProps={topBarProps} />}
        />
        <Route path=":sessionId/step/1" element={<WizardStep1 />} />
        <Route path=":sessionId/step/2" element={<WizardStep2 />} />
        <Route path=":sessionId/step/3" element={<WizardStep3 />} />
        <Route path=":sessionId/step/4" element={<WizardStep4 />} />
        <Route path=":sessionId/step/5" element={<WizardStep5 />} />
        <Route path=":sessionId/summary" element={<WizardSummary />} />
        <Route path="*" element={<Navigate to="drafts" replace />} />
      </Routes>
    </WizardProvider>
  );
};

export default WizardRouter;
