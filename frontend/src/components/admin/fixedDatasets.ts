import type { Dataset } from "./types";

export const fixedDatasetIds: string[] = [
  "customer_requirements",
  "hcl_demand",
  "interviewed_candidate_details",
  "hcl_onboarding_status",
  "optum_onboarding_status",
];

// Build synthetic datasets for the fixed allow-list; prefer real datasets when present.
export const buildFixedDatasets = (datasets: Dataset[]): Dataset[] => {
  return fixedDatasetIds.map((id) => {
    const real = datasets.find((d) => d.id === id || d.table_name === id);
    if (real) return real;
    return {
      id,
      original_file_name: `${id}.table`,
      table_name: id,
      row_count: 0,
      columns: [],
    } as Dataset;
  });
};
