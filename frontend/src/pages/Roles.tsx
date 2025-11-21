import axios from "../lib/axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircleIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../auth/AuthProvider";

const API_URL = import.meta.env.VITE_API_URL;

export default function Roles() {
  const { token } = useAuth();
  const [roles, setRoles] = useState<any[]>([]);
  const navigate = useNavigate();

  async function fetchRoles() {
    const res = await axios.get(`${API_URL}/roles`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setRoles(res.data);
  }

  useEffect(() => {
    fetchRoles();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-8 text-gray-100">
      <div className="flex justify-between mb-6">
        <h1 className="text-3xl font-bold">Roles</h1>
        <button
          onClick={() => navigate("/roles/new")}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-md hover:bg-indigo-500"
        >
          <PlusCircleIcon className="w-5 h-5" />
          New Role
        </button>
      </div>

      <div className="bg-[#1b1f28] rounded-xl p-6 border border-gray-700">
        {roles.length === 0 ? (
          <p className="text-gray-400 text-center">No roles found.</p>
        ) : (
          <table className="min-w-full text-left">
            <thead className="text-gray-400 text-sm uppercase border-b border-gray-700">
              <tr>
                <th className="py-3">Name</th>
                <th className="py-3">Description</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="py-3">{r.name}</td>
                  <td>{r.description || "—"}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => navigate(`/roles/${r.id}`)}
                      className="text-indigo-400 hover:text-indigo-300 mr-4"
                    >
                      <PencilIcon className="w-5 h-5 inline" />
                    </button>
                    <button className="text-red-400 hover:text-red-300">
                      <TrashIcon className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}