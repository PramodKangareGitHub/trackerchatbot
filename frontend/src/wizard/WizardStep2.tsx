import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { saveWizardStep } from "./wizardApi";
import { WizardLayout } from "./WizardLayout";

const initialForm = {
  demand_id: "",
  demand_type: "",
  hcl_manager: "",
  hcl_leader: "",
  hcl_vice_president: "",
  hcl_job_posting_date: "",
  hcl_job_role: "",
  hcl_skill_category: "",
  hcl_primary_skills: "",
  hcl_secondary_skills: "",
};

const WizardStep2: React.FC = () => {
  const { sessionId } = useParams();
  const { session, setSession, stepData, setStepData } = useWizard();
  const [form, setForm] = useState(stepData[2] || initialForm);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      await saveWizardStep(sessionId!, 2, form);
      setStepData(2, form);
      setSession({ ...session!, current_step: 2 });
      navigate(`/wizard/${sessionId}/step/3`);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(`/wizard/${sessionId}/step/1`);
  };

  return (
    <WizardLayout
      step={2}
      onNext={handleNext}
      onBack={handleBack}
      isSubmitting={loading}
    >
      <div className="grid grid-cols-2 gap-4">
        <input
          name="demand_id"
          value={form.demand_id}
          onChange={handleChange}
          placeholder="Demand ID"
          className="input"
        />
        <input
          name="demand_type"
          value={form.demand_type}
          onChange={handleChange}
          placeholder="Demand Type"
          className="input"
        />
        <input
          name="hcl_manager"
          value={form.hcl_manager}
          onChange={handleChange}
          placeholder="HCL Manager"
          className="input"
        />
        <input
          name="hcl_leader"
          value={form.hcl_leader}
          onChange={handleChange}
          placeholder="HCL Leader"
          className="input"
        />
        <input
          name="hcl_vice_president"
          value={form.hcl_vice_president}
          onChange={handleChange}
          placeholder="HCL Vice President"
          className="input"
        />
        <input
          name="hcl_job_posting_date"
          value={form.hcl_job_posting_date}
          onChange={handleChange}
          placeholder="HCL Job Posting Date"
          className="input"
        />
        <input
          name="hcl_job_role"
          value={form.hcl_job_role}
          onChange={handleChange}
          placeholder="HCL Job Role"
          className="input"
        />
        <input
          name="hcl_skill_category"
          value={form.hcl_skill_category}
          onChange={handleChange}
          placeholder="HCL Skill Category"
          className="input"
        />
        <input
          name="hcl_primary_skills"
          value={form.hcl_primary_skills}
          onChange={handleChange}
          placeholder="HCL Primary Skills"
          className="input"
        />
        <input
          name="hcl_secondary_skills"
          value={form.hcl_secondary_skills}
          onChange={handleChange}
          placeholder="HCL Secondary Skills"
          className="input"
        />
      </div>
    </WizardLayout>
  );
};

export default WizardStep2;
