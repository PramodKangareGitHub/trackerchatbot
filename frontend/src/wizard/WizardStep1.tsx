import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWizard } from "./WizardContext";
import { saveWizardStep } from "./wizardApi";
import { WizardLayout } from "./WizardLayout";

const initialForm = {
  job_posting_id: "",
  portfolio: "",
  sub_portfolio: "",
  tower: "",
  business_unit: "",
  location: "",
  sub_location: "",
  number_of_positions: "",
  requirement_type: "",
  customer_job_posting_date: "",
  job_role: "",
  skill_category: "",
  primary_skills: "",
  secondary_skills: "",
  customer_cio: "",
  customer_leader: "",
  customer_vice_president: "",
};

const WizardStep1: React.FC = () => {
  const { sessionId } = useParams();
  const { session, setSession, stepData, setStepData } = useWizard();
  const [form, setForm] = useState(stepData[1] || initialForm);
  const [uniqueId, setUniqueId] = useState(
    session?.job_posting_unique_id || ""
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const resp = await saveWizardStep(sessionId!, 1, form);
      setUniqueId(resp.unique_job_posting_id);
      setStepData(1, form);
      setSession({
        ...session!,
        job_posting_unique_id: resp.unique_job_posting_id,
        current_step: 1,
      });
      navigate(`/wizard/${sessionId}/step/2`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WizardLayout step={1} onNext={handleNext} isSubmitting={loading}>
      <div className="grid grid-cols-2 gap-4">
        <input
          name="job_posting_id"
          value={form.job_posting_id}
          onChange={handleChange}
          placeholder="Job Posting ID"
          className="input"
        />
        <input
          name="portfolio"
          value={form.portfolio}
          onChange={handleChange}
          placeholder="Portfolio"
          className="input"
        />
        {/* ...other fields... */}
        <input
          name="customer_vice_president"
          value={form.customer_vice_president}
          onChange={handleChange}
          placeholder="Customer Vice President"
          className="input"
        />
        <input
          name="unique_job_posting_id"
          value={uniqueId}
          readOnly
          placeholder="Unique Job Posting ID (auto)"
          className="input bg-slate-100"
        />
      </div>
    </WizardLayout>
  );
};

export default WizardStep1;
