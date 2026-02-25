import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { saveWizardStep } from "./wizardApi";
import { WizardLayout } from "./WizardLayout";

const initialForm = {
  candidate_id: "",
  candidate_name: "",
  candidate_email: "",
  candidate_phone: "",
  candidate_skills: "",
  candidate_experience: "",
  candidate_application_id: "",
  interview_stage: "",
  interview_result: "",
};

const WizardStep3: React.FC = () => {
  const { sessionId } = useParams();
  const { session, setSession, stepData, setStepData } = useWizard();
  const [form, setForm] = useState(stepData[3] || initialForm);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await saveWizardStep(sessionId!, 3, form);
      setStepData(3, form);
      setSession({ ...session!, current_step: 3 });
      navigate(`/wizard/${sessionId}/step/4`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/wizard/${sessionId}/step/2`);
  };

  return (
    <WizardLayout
      step={3}
      onNext={handleNext}
      onBack={handleBack}
      isSubmitting={loading}
    >
      <div className="grid grid-cols-2 gap-4">
        <input
          name="candidate_id"
          value={form.candidate_id}
          onChange={handleChange}
          placeholder="Candidate ID"
          className="input"
        />
        <input
          name="candidate_name"
          value={form.candidate_name}
          onChange={handleChange}
          placeholder="Candidate Name"
          className="input"
        />
        <input
          name="candidate_email"
          value={form.candidate_email}
          onChange={handleChange}
          placeholder="Candidate Email"
          className="input"
        />
        <input
          name="candidate_phone"
          value={form.candidate_phone}
          onChange={handleChange}
          placeholder="Candidate Phone"
          className="input"
        />
        <input
          name="candidate_skills"
          value={form.candidate_skills}
          onChange={handleChange}
          placeholder="Candidate Skills"
          className="input"
        />
        <input
          name="candidate_experience"
          value={form.candidate_experience}
          onChange={handleChange}
          placeholder="Candidate Experience"
          className="input"
        />
        <input
          name="candidate_application_id"
          value={form.candidate_application_id}
          onChange={handleChange}
          placeholder="Candidate Application ID"
          className="input"
        />
        <input
          name="interview_stage"
          value={form.interview_stage}
          onChange={handleChange}
          placeholder="Interview Stage"
          className="input"
        />
        <input
          name="interview_result"
          value={form.interview_result}
          onChange={handleChange}
          placeholder="Interview Result"
          className="input"
        />
      </div>
    </WizardLayout>
  );
};

export default WizardStep3;
