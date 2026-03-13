export type UserRole = "admin" | "developer" | "leader" | "delivery_manager";

export type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  row_count: number;
  columns: string[];
  created_at?: string;
};

export type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
  widget_count?: number;
  order_index?: number | null;
};

export type WidgetType = "table" | "chart";

export type FieldRef = { table: string; column: string; alias?: string };

export type FilterClause = {
  table?: string;
  field: string;
  op?: string; // preferred operator key
  operator?: string; // legacy/back-compat
  value: string | string[];
};

export type TableConfig = {
  dataset_id?: string; // legacy single-table config
  joined_tables?: string[]; // new: multi-table selection keyed on unique_job_posting_id
  fields?: string[]; // legacy field list
  filters?: FilterClause[]; // multiple where clauses
  join_key?: string; // new: key for joining tables
  group_by?: string;
  group_by_ref?: FieldRef;
  group_by_values?: string[];
  filter_by?: string;
  filter_by_ref?: FieldRef;
  filter_values?: string[];
};

export type ChartConfig = {
  dataset_id?: string;
  joined_tables?: string[];
  x_field?: string;
  y_field?: string;
  x_date_mode?: "raw" | "ageing" | "quarter" | "financial_quarter";
  x_ageing_ranges?: string[];
  x_quarter_values?: string[];
  x_fiscal_year_start_month?: number; // 1-12, defaults to Apr (4)
  y_axis_mode?: "count" | "value" | "ageing_days" | "date_diff";
  y_aggregation?: "sum" | "avg" | "min" | "max";
  y_start_date_field?: string;
  y_end_date_field?: string;
  join_key?: string; // new: key for joining tables
  x_ref?: FieldRef;
  y_ref?: FieldRef;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_ref?: FieldRef;
  group_by_values?: string[];
  filter_by?: string;
  filter_by_ref?: FieldRef;
  filter_values?: string[];
  filters?: FilterClause[];
};

export type Widget = {
  id?: string;
  dashboard_id?: string;
  title: string;
  widget_type?: WidgetType | null;
  order_index?: number | null;
  roles?: UserRole[];
  config?: TableConfig | ChartConfig;
};

export type ManagedUser = {
  id: string;
  email: string;
  role: UserRole;
  created_at?: string;
};

export const DEFAULT_ROLES: UserRole[] = [
  "admin",
  "developer",
  "leader",
  "delivery_manager",
];

export type RoleOption = {
  id?: string;
  name: string;
};
