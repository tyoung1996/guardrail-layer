// src/pages/Users.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from "@heroicons/react/24/solid";
import axios from "../lib/axios";
import { useAuth } from "../auth/AuthProvider";

const API_URL = import.meta.env.VITE_API_URL;

type UserRole = {
  role: {
    id: string;
    name: string;
    label?: string | null;
  };
};

type UserRow = {
  id: string;
  email: string;
  name?: string | null;
  disabled: boolean;
  isAdmin: boolean;
  createdAt?: string;
  roles: UserRole[];
};

export default function Users() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
  });

  // Optional: lock this down to admins only on the UI side
  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-200">
        Loading user…
      </div>
    );
  }

  // If you want to block non-admins:
  // if (!user.isAdmin) {
  //   return (
  //     <div className="w-full h-screen flex items-center justify-center text-gray-400">
  //       You do not have permission to view users.
  //     </div>
  //   );
  // }

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await axios.get<UserRow[]>(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("❌ Failed to fetch users:", err.message || err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newUser.email || !newUser.password) {
      setCreateError("Email and password are required.");
      return;
    }
    setCreateError(null);
    setCreating(true);

    try {
      await axios.post(
        `${API_URL}/users`,
        {
          email: newUser.email,
          password: newUser.password,
          name: newUser.name || undefined,
          // roles: [] // could wire this later
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNewUser({ email: "", name: "", password: "" });
      await fetchUsers();
    } catch (err: any) {
      console.error("❌ Failed to create user:", err);
      setCreateError(
        err?.response?.data?.error ||
          "Failed to create user. Check console for details."
      );
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const prettyLastRefreshed = useMemo(() => {
    if (!lastRefreshedAt) return "—";
    return lastRefreshedAt.toLocaleTimeString();
  }, [lastRefreshedAt]);

  const statusBadge = (u: UserRow) => {
    if (u.disabled) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-semibold">
          <XCircleIcon className="w-4 h-4" />
          Disabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
        <CheckCircleIcon className="w-4 h-4" />
        Active
      </span>
    );
  };

  const roleBadges = (u: UserRow) => {
    if (u.isAdmin) {
      // Treat the isAdmin flag as a "system admin" badge
      return (
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 text-xs font-semibold">
            Admin
          </span>
        </div>
      );
    }

    if (!u.roles || u.roles.length === 0) {
      return (
        <span className="text-xs text-gray-500 italic">No roles</span>
      );
    }

    return (
      <div className="flex flex-wrap gap-1">
        {u.roles.map((r) => (
          <span
            key={r.role.id}
            className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            {r.role.label || r.role.name}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1115] via-[#141820] to-[#0f1115] text-gray-100 font-sans">
      <main className="max-w-5xl mx-auto py-12 px-6 sm:px-10">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserIcon className="w-8 h-8 text-indigo-400" />
              Users
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              Manage application users and their access.
            </p>
          </div>
          <div className="text-xs text-gray-400">
            Last refreshed:{" "}
            <span className="font-mono">{prettyLastRefreshed}</span>
          </div>
        </div>

        {/* Create User Card */}
        <section className="bg-[#1b1f28] rounded-xl p-6 shadow-lg border border-gray-800 mb-10">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Create User
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((prev) => ({ ...prev, password: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                placeholder="Minimum 6 characters"
              />
            </div>
          </div>
          {createError && (
            <p className="mt-3 text-sm text-red-400">{createError}</p>
          )}
          <div className="mt-5 flex justify-end">
            <button
              onClick={handleCreateUser}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md hover:shadow-emerald-600/30 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircleIcon className="w-5 h-5" />
              {creating ? "Creating..." : "Create User"}
            </button>
          </div>
        </section>

        {/* Users Table */}
        <section aria-labelledby="users-table">
          <h3
            id="users-table"
            className="text-lg font-semibold text-gray-100 mb-3"
          >
            All Users
          </h3>

          {loading ? (
            <p className="text-gray-400 py-10 text-center">Loading users…</p>
          ) : users.length === 0 ? (
            <p className="text-gray-500 text-center py-12 select-none rounded-xl border border-dashed border-gray-800 bg-[#131720]">
              No users yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#141922] shadow-lg">
              <table className="min-w-full text-left text-gray-300">
                <thead className="bg-[#10141b] text-xs uppercase tracking-wide border-b border-gray-800">
                  <tr>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">
                      Name
                    </th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">
                      Email
                    </th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">
                      Roles
                    </th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">
                      Status
                    </th>
                    <th className="py-3.5 px-5 font-semibold text-right text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => navigate(`/users/${u.id}`)}
                    >
                      <td className="py-3 px-5 font-medium text-gray-100">
                        {u.name || "—"}
                      </td>
                      <td className="py-3 px-5 text-gray-300">
                        {u.email}
                      </td>
                      <td className="py-3 px-5">
                        {roleBadges(u)}
                      </td>
                      <td className="py-3 px-5">
                        {statusBadge(u)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/users/${u.id}`);
                          }}
                          className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-500 transition-colors"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}