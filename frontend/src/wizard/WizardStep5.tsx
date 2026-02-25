import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { saveWizardStep } from "./wizardApi";
import { WizardLayout } from "./WizardLayout";

const initialForm = {
  optum_onboarding_status: "",
  optum_onboarding_date: "",
  optum_manager: "",
  optum_notes: "",
};

const WizardStep5: React.FC = () => {
  const { sessionId } = useParams();
  const { session, setSession, stepData, setStepData } = useWizard();
  const [form, setForm] = useState(stepData[5] || initialForm);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await saveWizardStep(sessionId!, 5, form);
      setStepData(5, form);
      setSession({ ...session!, current_step: 5 });
      navigate(`/wizard/${sessionId}/summary`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/wizard/${sessionId}/step/4`);
  };

  return (
    <WizardLayout
      step={5}
      onNext={handleNext}
      onBack={handleBack}
      isSubmitting={loading}
    >
      <div className="grid grid-cols-2 gap-4">
        <input
          name="optum_onboarding_status"
          value={form.optum_onboarding_status}
          onChange={handleChange}
          placeholder="Optum Onboarding Status"
          className="input"
        />
        <input
          name="optum_onboarding_date"
          value={form.optum_onboarding_date}
          onChange={handleChange}
          placeholder="Optum Onboarding Date"
          className="input"
        />
        <input
          name="optum_manager"
          value={form.optum_manager}
          onChange={handleChange}
          placeholder="Optum Manager"
          className="input"
        />
        <input
          name="optum_notes"
          value={form.optum_notes}
          onChange={handleChange}
          placeholder="Optum Notes"
          className="input"
        />
      </div>
    </WizardLayout>
  );
};

export default WizardStep5;
