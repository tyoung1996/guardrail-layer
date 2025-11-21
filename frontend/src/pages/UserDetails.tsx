// src/pages/UserDetail.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
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

type UserDetail = {
  id: string;
  email: string;
  name?: string | null;
  disabled: boolean;
  isAdmin: boolean;
  createdAt?: string;
  updatedAt?: string;
  roles: UserRole[];
};

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    disabled: false,
  });

  useEffect(() => {
    if (!id) return;
    async function fetchUser() {
      try {
        setLoading(true);
        const res = await axios.get<UserDetail>(`${API_URL}/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setDetail(res.data);
        setForm({
          name: res.data.name || "",
          email: res.data.email || "",
          password: "",
          disabled: res.data.disabled,
        });
      } catch (err: any) {
        console.error("❌ Failed to fetch user:", err);
        setError(
          err?.response?.data?.error || "Failed to fetch user details."
        );
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id, token]);

  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-200">
        Loading user…
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: form.name || undefined,
        email: form.email || undefined,
        disabled: form.disabled,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const res = await axios.patch(`${API_URL}/users/${id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDetail((prev) =>
        prev
          ? {
              ...prev,
              name: res.data.name ?? prev.name,
              email: res.data.email ?? prev.email,
              disabled: res.data.disabled ?? prev.disabled,
            }
          : prev
      );

      if (form.password) {
        setForm((f) => ({ ...f, password: "" }));
      }
    } catch (err: any) {
      console.error("❌ Failed to update user:", err);
      setError(
        err?.response?.data?.error || "Failed to update user. Check console."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    if (!id) return;
    if (!window.confirm("Disable this user? They will no longer be able to log in.")) {
      return;
    }
    setDeleting(true);
    setError(null);

    try {
      await axios.delete(`${API_URL}/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/users");
    } catch (err: any) {
      console.error("❌ Failed to disable user:", err);
      setError(
        err?.response?.data?.error || "Failed to disable user. Check console."
      );
    } finally {
      setDeleting(false);
    }
  };

  const statusBadge = () => {
    if (!detail) return null;
    if (detail.disabled) {
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

  const rolesBlock = () => {
    if (!detail) return null;
    if (detail.isAdmin) {
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-600/20 text-indigo-300 text-xs font-semibold">
            Admin
          </span>
        </div>
      );
    }
    if (!detail.roles || detail.roles.length === 0) {
      return (
        <p className="text-xs text-gray-500 mt-1 italic">No roles assigned.</p>
      );
    }
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {detail.roles.map((r) => (
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
      <main className="max-w-3xl mx-auto py-10 px-6 sm:px-10">
        <button
          onClick={() => navigate("/users")}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Users
        </button>

        {loading ? (
          <p className="text-gray-400">Loading user…</p>
        ) : !detail ? (
          <p className="text-red-400">User not found.</p>
        ) : (
          <div className="bg-[#1b1f28] rounded-xl p-6 shadow-lg border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">
                  {detail.name || detail.email}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  ID: <span className="font-mono text-xs">{detail.id}</span>
                </p>
                {rolesBlock()}
              </div>
              <div className="flex flex-col items-end gap-2">
                {statusBadge()}
                {detail.isAdmin && (
                  <span className="text-xs text-indigo-300">
                    System admin (full access)
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  id="disabled"
                  type="checkbox"
                  checked={form.disabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, disabled: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-600 bg-[#12151c] text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="disabled"
                  className="text-sm text-gray-200 select-none"
                >
                  Disable user
                </label>
              </div>

              <div className="flex justify-between items-center mt-4">
                <div className="text-xs text-gray-500">
                  <div>
                    Created:{" "}
                    {detail.createdAt
                      ? new Date(detail.createdAt).toLocaleString()
                      : "—"}
                  </div>
                  <div>
                    Updated:{" "}
                    {detail.updatedAt
                      ? new Date(detail.updatedAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleDisable}
                    disabled={deleting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-sm font-semibold text-white shadow hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="w-4 h-4" />
                    {deleting ? "Disabling…" : "Disable User"}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white shadow hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}