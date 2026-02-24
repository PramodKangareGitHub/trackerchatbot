import { useState } from "react";

type RoleManagementSectionProps = {
  roles: string[];
  loading?: boolean;
  onCreateRole: (name: string) => Promise<void> | void;
  onDeleteRole: (name: string) => Promise<void> | void;
};

const RoleManagementSection = ({
  roles,
  loading = false,
  onCreateRole,
  onDeleteRole,
}: RoleManagementSectionProps) => {
  const [roleName, setRoleName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddRole = async () => {
    setError(null);
    const trimmed = roleName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) {
      setError("Role name is required");
      return;
    }
    if (roles.includes(trimmed)) {
      setError("Role already exists");
      return;
    }
    setSaving(true);
    try {
      await onCreateRole(trimmed);
      setRoleName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: string) => {
    setSaving(true);
    setError(null);
    try {
      await onDeleteRole(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Role Management
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage available roles (stored in the database).
          </p>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Role Name
          </label>
          <input
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            className="min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="e.g. analyst"
            disabled={saving}
          />
          <button
            type="button"
            onClick={handleAddRole}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Saving…" : "Add Role"}
          </button>
        </div>
        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <div className="mt-2 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Roles
          </h4>
          {loading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading roles…
            </p>
          )}
          {!loading && !roles.length && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No roles yet.
            </p>
          )}
          {!loading &&
            roles.map((role) => {
              const normalized = role.trim().toLowerCase();
              const isProtected = normalized === "admin";
              return (
                <div
                  key={role}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <span className="font-semibold">
                    {role.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    {isProtected && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                        Protected
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(role)}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:bg-slate-800 dark:text-rose-100"
                      disabled={saving || isProtected}
                      title={
                        isProtected
                          ? "Admin role cannot be deleted"
                          : "Delete role"
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
};

export default RoleManagementSection;
