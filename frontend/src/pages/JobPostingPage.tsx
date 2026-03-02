import { useLocation, useNavigate } from "react-router-dom";
import JobPosting, {
  JobPostingProps,
} from "../components/JobPosting/JobPosting";

export type JobPostingPageState = {
  record?: Record<string, unknown>;
  viewOnly?: boolean;
};

type JobPostingPageProps = {
  authToken?: string | null;
  authUserEmail?: string | null;
};

const JobPostingPage: React.FC<JobPostingPageProps> = ({
  authToken,
  authUserEmail,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as JobPostingPageState) || {};
  const viewOnly = Boolean(state.viewOnly);

  const initialRequirement = ((): JobPostingProps["initialRequirement"] => {
    if (!state.record || typeof state.record !== "object") return null;
    const rec = state.record as Record<string, unknown>;
    return {
      unique_job_posting_id: rec.unique_job_posting_id as string | undefined,
      portfolio: rec.portfolio as string | undefined,
      sub_portfolio: rec.sub_portfolio as string | undefined,
      tower: rec.tower as string | undefined,
      customer_cio: rec.customer_cio as string | undefined,
      customer_leader: rec.customer_leader as string | undefined,
      customer_vice_president: rec.customer_vice_president as
        | string
        | undefined,
      customer_senior_director: rec.customer_senior_director as
        | string
        | undefined,
      customer_director: rec.customer_director as string | undefined,
      customer_hiring_manager: rec.customer_hiring_manager as
        | string
        | undefined,
      customer_band: rec.customer_band as string | undefined,
      hcl_leader: rec.hcl_leader as string | undefined,
      hcl_deliver_spoc: rec.hcl_deliver_spoc as string | undefined,
      job_posting_id: rec.job_posting_id as string | undefined,
      location: rec.location as string | undefined,
      sub_location: rec.sub_location as string | undefined,
      requirement_type: rec.requirement_type as string | undefined,
      business_unit: rec.business_unit as string | undefined,
      customer_job_posting_date: rec.customer_job_posting_date as
        | string
        | undefined,
      number_of_positions: rec.number_of_positions as number | undefined,
      sell_rate: rec.sell_rate as number | undefined,
      job_posting_status: rec.job_posting_status as string | undefined,
      job_role: rec.job_role as string | undefined,
      skill_category: rec.skill_category as string | undefined,
      primary_skills: rec.primary_skills as string | undefined,
      secondary_skills: rec.secondary_skills as string | undefined,
      created_at: rec.created_at as string | undefined,
      updated_at: rec.updated_at as string | undefined,
      created_by: rec.created_by as string | undefined,
      modified_by: rec.modified_by as string | undefined,
    };
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Job Posting</h2>
          <p className="text-sm text-slate-600">
            {viewOnly
              ? "View customer requirement, demand, and onboarding details."
              : "Edit or review customer requirement and HCL demand details."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg border border-sky-600 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
          >
            Go to Dashboard
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <JobPosting
          initialRequirement={initialRequirement}
          authToken={authToken}
          currentUser={authUserEmail}
          viewOnly={viewOnly}
        />
      </div>
    </div>
  );
};

export default JobPostingPage;
