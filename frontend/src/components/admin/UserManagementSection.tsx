import type { Dispatch, SetStateAction } from "react";
import type { ManagedUser, UserRole } from "./types";

export type UserManagementSectionProps = {
  users: ManagedUser[];
  usersLoading: boolean;
  newUserEmail: string;
  setNewUserEmail: Dispatch<SetStateAction<string>>;
  newUserPassword: string;
  setNewUserPassword: Dispatch<SetStateAction<string>>;
  newUserRole: UserRole;
  setNewUserRole: Dispatch<SetStateAction<UserRole>>;
  onCreateUser: () => void;
  creatingUser: boolean;
  onRefreshUsers: () => void;
  editingUserId: string | null;
  setEditingUserId: Dispatch<SetStateAction<string | null>>;
  editingPassword: string;
  setEditingPassword: Dispatch<SetStateAction<string>>;
  onChangePassword: () => void;
  savingPassword: boolean;
  deletingUserId: string | null;
  onDeleteUser: (userId: string) => void;
};

const UserManagementSection = ({
  users,
  usersLoading,
  newUserEmail,
  setNewUserEmail,
  newUserPassword,
  setNewUserPassword,
  newUserRole,
  setNewUserRole,
  onCreateUser,
  creatingUser,
  onRefreshUsers,
  editingUserId,
  setEditingUserId,
  editingPassword,
  setEditingPassword,
  onChangePassword,
  savingPassword,
  deletingUserId,
  onDeleteUser,
}: UserManagementSectionProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/70">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Create User
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Leader / Delivery Manager / Admin / Developer
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Email
          </label>
          <input
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="user@example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Password
          </label>
          <input
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="Set a password"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
            Role
          </label>
          <select
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="leader">Leader</option>
            <option value="delivery_manager">Delivery Manager</option>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          New users must log in with the email/password you set.
        </p>
        <button
          type="button"
          onClick={onCreateUser}
          disabled={creatingUser || !newUserEmail || !newUserPassword}
          className="inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          {creatingUser ? "Creating…" : "Create user"}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white/70 p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100">
            Existing users
          </h4>
          <button
            type="button"
            onClick={onRefreshUsers}
            className="text-xs text-sky-600 underline hover:text-sky-700 dark:text-sky-300"
          >
            Refresh
          </button>
        </div>
        {usersLoading && (
          <p className="text-slate-500 dark:text-slate-400">Loading users…</p>
        )}
        {!usersLoading && !users.length && (
          <p className="text-slate-500 dark:text-slate-400">No users yet.</p>
        )}
        {!usersLoading && users.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Email
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Role
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Created
                  </th>
                  <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                      {u.email}
                    </td>
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                      {u.role.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString()
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <div className="flex-1">
                          {u.role === "leader" ||
                          u.role === "delivery_manager" ? (
                            editingUserId === u.id ? (
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                  type="password"
                                  value={editingPassword}
                                  onChange={(e) =>
                                    setEditingPassword(e.target.value)
                                  }
                                  className="w-full min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  placeholder="New password"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={onChangePassword}
                                    disabled={
                                      savingPassword || !editingPassword
                                    }
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                                  >
                                    {savingPassword ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingUserId(null);
                                      setEditingPassword("");
                                    }}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(u.id);
                                  setEditingPassword("");
                                }}
                                className="text-xs font-semibold text-sky-600 underline hover:text-sky-700 dark:text-sky-300"
                              >
                                Change password
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-slate-500">N/A</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u.id)}
                          disabled={deletingUserId === u.id}
                          className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:border-rose-300 hover:text-rose-800 disabled:opacity-60 dark:border-rose-600 dark:bg-slate-900 dark:text-rose-200"
                        >
                          {deletingUserId === u.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default UserManagementSection;
