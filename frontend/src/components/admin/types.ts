export type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  row_count: number;
  columns: string[];
  created_at?: string;
};

export type UserRole = string;

export type Dashboard = {
  id: string;
  name: string;
  description?: string | null;
  widget_count?: number;
  order_index?: number | null;
};

export type WidgetType = "table" | "chart";

export type FieldRef = { table: string; column: string; alias?: string };

export type TableConfig = {
  dataset_id?: string; // legacy single-table config
  joined_tables?: string[]; // new: multi-table selection keyed on unique_job_posting_id
  fields?: string[]; // legacy field list
  field_refs?: FieldRef[]; // new: table-qualified fields
  join_key?: string; // new: key for joining tables
  group_by?: string;
  group_by_ref?: FieldRef;
  group_by_values?: string[];
  filter_by?: string;
  filter_by_ref?: FieldRef;
  filter_values?: string[];
  filters?: { table?: string; field: string; value: string }[]; // new: multiple where clauses
};

export type ChartConfig = {
  dataset_id?: string;
  joined_tables?: string[];
  x_field?: string;
  y_field?: string;
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
  filters?: { table?: string; field: string; value: string }[];
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
