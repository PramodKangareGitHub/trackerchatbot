import { Dispatch, SetStateAction } from "react";
import type {
  Dashboard,
  Dataset,
  UserRole,
  Widget,
  WidgetType,
} from "../types";

export type WidgetEntry = {
  widget: Widget;
  widgetIdx: number;
  widgetKey: string;
  widgetType: WidgetType;
  datasetId: string;
};

export type DashboardSelectorActionsProps = {
  dashboards: Dashboard[];
  dashboardsLoading: boolean;
  selectedDashboardId: string | null;
  onSelectDashboard: (dashboardId: string) => void;
  onReorderDashboard: (dashboardId: string, direction: "up" | "down") => void;
  editDashboardName: string;
  editDashboardDesc: string;
  setEditDashboardName: Dispatch<SetStateAction<string>>;
  setEditDashboardDesc: Dispatch<SetStateAction<string>>;
  handleUpdateDashboard: () => void | Promise<void>;
  handleDeleteDashboard: () => void | Promise<void>;
  newDashboardName: string;
  newDashboardDesc: string;
  setNewDashboardName: Dispatch<SetStateAction<string>>;
  setNewDashboardDesc: Dispatch<SetStateAction<string>>;
  handleCreateDashboard: () => void | Promise<void>;
  dashboardSaving: boolean;
  datasets: Dataset[];
  activeDatasetId: string;
  onSelectDataset: (datasetId: string) => void;
  scopedWidgets: WidgetEntry[];
  previewWidgetId: string | null;
  setPreviewWidgetId: Dispatch<SetStateAction<string | null>>;
  setShowPreview: Dispatch<SetStateAction<boolean>>;
  userRole: UserRole;
};

const DashboardSelectorActions = ({
  dashboards,
  dashboardsLoading,
  selectedDashboardId,
  onSelectDashboard,
  onReorderDashboard,
  editDashboardName,
  editDashboardDesc,
  setEditDashboardName,
  setEditDashboardDesc,
  handleUpdateDashboard,
  handleDeleteDashboard,
  newDashboardName,
  newDashboardDesc,
  setNewDashboardName,
  setNewDashboardDesc,
  handleCreateDashboard,
  dashboardSaving,
  datasets,
  activeDatasetId,
  onSelectDataset,
  scopedWidgets,
  previewWidgetId,
  setPreviewWidgetId,
  setShowPreview,
  userRole,
}: DashboardSelectorActionsProps) => {
  const selectedIndex = dashboards.findIndex(
    (d) => d.id === selectedDashboardId
  );
  const canMoveUp = selectedIndex > 0;
  const canMoveDown =
    selectedIndex !== -1 && selectedIndex < dashboards.length - 1;
  const isHomeDashboard = selectedDashboardId === "home";

  return (
    <div className="mb-3 space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Dashboard Config
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create dashboards, then attach widgets to each one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="space-y-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-200">
              Dashboard List
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedDashboardId ?? ""}
                onChange={(e) => onSelectDashboard(e.target.value)}
                disabled={dashboardsLoading || dashboards.length === 0}
                className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {dashboardsLoading && <option>Loading...</option>}
                {!dashboardsLoading && dashboards.length === 0 && (
                  <option value="">No dashboards</option>
                )}
                {!dashboardsLoading &&
                  dashboards.map((dash) => (
                    <option key={dash.id} value={dash.id}>
                      {dash.name}
                      {typeof dash.widget_count === "number"
                        ? ` (${dash.widget_count})`
                        : ""}
                    </option>
                  ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    selectedDashboardId &&
                    onReorderDashboard(selectedDashboardId, "up")
                  }
                  disabled={!canMoveUp}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() =>
                    selectedDashboardId &&
                    onReorderDashboard(selectedDashboardId, "down")
                  }
                  disabled={!canMoveDown}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  title="Move down"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Selected Dashboard
            </label>
            <input
              value={editDashboardName}
              onChange={(e) => setEditDashboardName(e.target.value)}
              placeholder="Dashboard name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              disabled={!selectedDashboardId || dashboardSaving}
            />
          </div>
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Description
            </label>
            <input
              value={editDashboardDesc}
              onChange={(e) => setEditDashboardDesc(e.target.value)}
              placeholder="Optional description"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              disabled={!selectedDashboardId || dashboardSaving}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUpdateDashboard}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              disabled={!selectedDashboardId || dashboardSaving}
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleDeleteDashboard}
              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
              disabled={
                !selectedDashboardId || dashboardSaving || isHomeDashboard
              }
            >
              Delete
            </button>
          </div>
        </div>
        {userRole === "admin" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <div className="flex-1 min-w-[220px] space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                New Dashboard
              </label>
              <input
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Dashboard name"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                disabled={dashboardSaving}
              />
            </div>
            <div className="flex-1 min-w-[220px] space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Description
              </label>
              <input
                value={newDashboardDesc}
                onChange={(e) => setNewDashboardDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                disabled={dashboardSaving}
              />
            </div>
            <button
              type="button"
              onClick={handleCreateDashboard}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              disabled={dashboardSaving || !newDashboardName.trim()}
            >
              Create
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSelectorActions;
