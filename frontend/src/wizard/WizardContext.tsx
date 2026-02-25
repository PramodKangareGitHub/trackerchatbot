import React, { createContext, useContext, useState } from "react";

export type WizardSession = {
  id: string;
  status: string;
  current_step: number;
  job_posting_unique_id?: string;
  demand_id?: string;
  candidate_application_id?: string;
};

export type WizardContextType = {
  session: WizardSession | null;
  setSession: (s: WizardSession | null) => void;
  stepData: Record<number, any>;
  setStepData: (step: number, data: any) => void;
};

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [session, setSession] = useState<WizardSession | null>(null);
  const [stepData, setStepDataState] = useState<Record<number, any>>({});

  const setStepData = (step: number, data: any) => {
    setStepDataState((prev) => ({ ...prev, [step]: data }));
  };

  return (
    <WizardContext.Provider
      value={{ session, setSession, stepData, setStepData }}
    >
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within WizardProvider");
  return ctx;
};
