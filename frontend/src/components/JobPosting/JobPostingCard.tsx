import React from "react";

type JobPostingCardProps = {
  title: string;
  uniqueId?: string;
  location?: string;
  status?: string;
  postedOn?: string;
  onSelect?: () => void;
};

// Simple starter card for displaying a single job posting.
// Extend this component with additional fields or actions as needed.
const JobPostingCard: React.FC<JobPostingCardProps> = ({
  title,
  uniqueId,
  location,
  status,
  postedOn,
  onSelect,
}) => {
  return (
    <div
      className="border border-slate-200 rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition-shadow cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {status ? (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wide">
            {status}
          </span>
        ) : null}
      </div>
      <div className="text-sm text-slate-600 space-y-1">
        {uniqueId ? <div>ID: {uniqueId}</div> : null}
        {location ? <div>Location: {location}</div> : null}
        {postedOn ? <div>Posted: {postedOn}</div> : null}
      </div>
    </div>
  );
};

export default JobPostingCard;
