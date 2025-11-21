import axios from "../lib/axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const API_URL = import.meta.env.VITE_API_URL;

export default function RoleDetail() {
  const { user, token } = useAuth();
  const { id } = useParams();
  const isNew = !id || id === "new";
  const [role, setRole] = useState<any>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [allowedConnections, setAllowedConnections] = useState<any[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [roleRedactionJson, setRoleRedactionJson] = useState("{}");

  async function loadRole() {
    if (isNew) {
      setRole({ id: "new" });
      setName("");
      setDesc("");
      setAssignedUsers([]);
      setAllowedConnections([]);
      return;
    }

    const r = await axios.get(`${API_URL}/roles/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setRole(r.data);
    setName(r.data.name);
    setDesc(r.data.description || "");
    setAssignedUsers((r.data.users || []).map((u: any) => u.user ?? u));
    setAllowedConnections(
      (r.data.connectionPermissions || []).map((p: any) => p.connection)
    );
  }

  async function loadUsers() {
    const u = await axios.get(`${API_URL}/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setUsers(u.data);
  }

  async function loadConnections() {
    const res = await axios.get(`${API_URL}/connections`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setConnections(res.data);
  }

  async function saveRole() {
    if (isNew) {
      const res = await axios.post(`${API_URL}/roles`, {
        name,
        description: desc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Created");
      return;
    }

    await axios.patch(`${API_URL}/roles/${id}`, {
      name,
      description: desc
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    alert("Saved");
  }

  async function toggleUser(userId: string, isAssigned: boolean) {
    const url = isAssigned
      ? `${API_URL}/roles/${id}/unassign`
      : `${API_URL}/roles/${id}/assign`;

    await axios.post(url, { userId }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    loadRole();
  }

  async function toggleConnection(userId: string, connectionId: string, isAllowed: boolean) {
    const url = isAllowed
    ? `${API_URL}/roles/${id}/connections/unassign`
    : `${API_URL}/roles/${id}/connections/assign`;

    await axios.post(url, { userId, connectionId }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    loadRole();
  }

 
  useEffect(() => {
    loadRole();
    loadUsers();
    loadConnections();
  }, []);

  useEffect(() => {
    async function loadRoleRedactions() {
      if (!selectedConnectionId) return;
      const res = await axios.get(`${API_URL}/redactions/role/${selectedConnectionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const entry = res.data.find((x: any) => x.roleId === id);
      setRoleRedactionJson(entry ? JSON.stringify(entry.rules, null, 2) : "{}");
    }
    loadRoleRedactions();
  }, [selectedConnectionId]);

  if (!role) return <p className="text-gray-200">Loading…</p>;

  return (
    <div className="max-w-3xl mx-auto p-8 text-gray-100">
      <h1 className="text-3xl font-bold mb-6">
        {isNew ? "Create Role" : "Edit Role"}
      </h1>

      {/* Role details */}
      {role.name === "admin" ? (
        <div className="bg-[#1b1f28] p-6 rounded-xl border border-gray-700 mb-8">
          <p className="text-gray-400 italic mb-4">
            The admin role cannot be renamed or edited. You may only assign users to it.
          </p>
        </div>
      ) : (
        <div className="bg-[#1b1f28] p-6 rounded-xl border border-gray-700 mb-8">
          <label className="block mb-3">Role Name</label>
          <input
            className="w-full px-3 py-2 bg-[#141820] border border-gray-600 rounded-md mb-6"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="block mb-3">Description</label>
          <textarea
            className="w-full px-3 py-2 bg-[#141820] border border-gray-600 rounded-md"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />

          <button
            onClick={saveRole}
            className="mt-6 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500"
          >
            Save Role
          </button>
        </div>
      )}

      {/* Assigned users */}
      {!isNew && (
        <div className="bg-[#1b1f28] p-6 rounded-xl border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Assigned Users</h2>

          {users.map((u) => {
            const isAssigned = assignedUsers.some((x) => x.id === u.id);
            return (
              <div
                key={u.id}
                className="flex justify-between py-2 border-b border-gray-800"
              >
                <span>{u.email}</span>
                <button
                  onClick={() => toggleUser(u.id, isAssigned)}
                  className={`px-3 py-1 rounded-md ${
                    isAssigned ? "bg-red-600" : "bg-emerald-600"
                  }`}
                >
                  {isAssigned ? "Remove" : "Assign"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isNew && (
        <div className="bg-[#1b1f28] p-6 rounded-xl border border-gray-700 mt-8">
          <h2 className="text-xl font-semibold mb-4">Allowed Connections</h2>

          {role.name === "admin" ? (
            <p className="text-gray-400 italic">Admin role automatically has access to all connections and cannot be changed.</p>
          ) : (
            connections.map((c) => {
              const isAllowed = allowedConnections.some((x) => x.id === c.id);
              return (
                <div
                  key={c.id}
                  className="flex justify-between py-2 border-b border-gray-800"
                >
                  <span>{c.name}</span>
                  <button
                    onClick={() => toggleConnection(user.id, c.id, isAllowed)}
                    className={`px-3 py-1 rounded-md ${
                      isAllowed ? "bg-red-600" : "bg-emerald-600"
                    }`}
                  >
                    {isAllowed ? "Remove" : "Allow"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {!isNew && (
        <>
          {/* Role-based redactions */}
          <div className="bg-[#1b1f28] p-6 rounded-xl border border-gray-700 mt-8">
            <h2 className="text-xl font-semibold mb-4">Role-Based Redactions</h2>

            <p className="text-gray-400 text-sm mb-4">
              Manage role-specific redaction rules using the full Redaction Editor.
            </p>

            <div className="space-y-3">
              {allowedConnections.length === 0 && (
                <p className="text-gray-400 italic">This role has no allowed connections yet.</p>
              )}

              {role.name === "admin" ? (
                <p className="text-gray-400 italic">Admin role always sees full unredacted data. No role‑based redactions apply.</p>
              ) : (
                allowedConnections.map((conn: any) => (
                  <a
                    key={conn.id}
                    href={`/roles/${id}/redactions/${conn.id}`}
                    className="block px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-500 text-white"
                  >
                    Open Redaction Editor for {conn.name}
                  </a>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}