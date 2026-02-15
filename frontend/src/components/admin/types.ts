export type Dataset = {
  id: string;
  original_file_name: string;
  table_name: string;
  row_count: number;
  columns: string[];
  created_at?: string;
};

export type UserRole = "admin" | "developer" | "leader" | "delivery_manager";

export type WidgetType = "table" | "chart";

export type TableConfig = {
  dataset_id?: string;
  fields?: string[];
  group_by?: string;
  group_by_values?: string[];
};

export type ChartConfig = {
  dataset_id?: string;
  x_field?: string;
  y_field?: string;
  chart_type?: "bar" | "line" | "pie";
  group_by?: string;
  group_by_values?: string[];
};

export type Widget = {
  id?: string;
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

export const ROLE_OPTIONS: UserRole[] = [
  "admin",
  "developer",
  "leader",
  "delivery_manager",
];
