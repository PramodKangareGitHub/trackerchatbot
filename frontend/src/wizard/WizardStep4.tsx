import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { saveWizardStep } from "./wizardApi";
import { WizardLayout } from "./WizardLayout";

const initialForm = {
  onboarding_status: "",
  onboarding_date: "",
  onboarding_manager: "",
  onboarding_notes: "",
};

const WizardStep4: React.FC = () => {
  const { sessionId } = useParams();
  const { session, setSession, stepData, setStepData } = useWizard();
  const [form, setForm] = useState(stepData[4] || initialForm);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await saveWizardStep(sessionId!, 4, form);
      setStepData(4, form);
      setSession({ ...session!, current_step: 4 });
      navigate(`/wizard/${sessionId}/step/5`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/wizard/${sessionId}/step/3`);
  };

  return (
    <WizardLayout
      step={4}
      onNext={handleNext}
      onBack={handleBack}
      isSubmitting={loading}
    >
      <div className="grid grid-cols-2 gap-4">
        <input
          name="onboarding_status"
          value={form.onboarding_status}
          onChange={handleChange}
          placeholder="Onboarding Status"
          className="input"
        />
        <input
          name="onboarding_date"
          value={form.onboarding_date}
          onChange={handleChange}
          placeholder="Onboarding Date"
          className="input"
        />
        <input
          name="onboarding_manager"
          value={form.onboarding_manager}
          onChange={handleChange}
          placeholder="Onboarding Manager"
          className="input"
        />
        <input
          name="onboarding_notes"
          value={form.onboarding_notes}
          onChange={handleChange}
          placeholder="Onboarding Notes"
          className="input"
        />
      </div>
    </WizardLayout>
  );
};

export default WizardStep4;
