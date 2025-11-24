import axios from "../lib/axios";
import { useEffect, useState } from "react";
import { TrashIcon, KeyIcon, PlusCircleIcon } from "@heroicons/react/24/solid";

const API_URL = import.meta.env.VITE_API_URL;
const SHOW_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

type ApiToken = {
  id: string;
  name: string;
  createdAt: string;
  lastUsed?: string | null;
  revoked: boolean;
  token?: string; // only returned on creation
};

export default function ApiKeys() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newName, setNewName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchTokens() {
    try {
      const res = await axios.get(`${API_URL}/api/tokens`);
      setTokens(res.data || []);
    } catch (err: any) {
      console.error("❌ Failed to fetch tokens:", err.message);
    }
  }

  async function createToken() {
    if (!newName.trim()) {
      window.alert("Please enter a token name first.");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/tokens`, { name: newName });
      setNewToken(res.data.token);
      setNewName("");
      fetchTokens();
    } catch (err: any) {
      console.error("❌ Failed to create token:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm("Revoke this token? It cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/api/tokens/${id}`);
      fetchTokens();
    } catch (err: any) {
      console.error("❌ Failed to revoke token:", err.message);
    }
  }

  useEffect(() => {
    fetchTokens();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1115] via-[#141820] to-[#0f1115] text-gray-100 font-sans">
      {SHOW_DEMO && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-center py-3 font-medium">
          Demo Mode — Token management is disabled.
        </div>
      )}

      <main className="max-w-5xl mx-auto py-12 px-6 sm:px-10">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">API Access Tokens</h2>
          <p className="text-gray-400 mt-2 text-sm">
            Manage tokens for external API access to the Guardrail Layer chat endpoints.
          </p>
        </div>

        {/* New Token Form */}
        <section className="bg-[#1b1f28] rounded-xl p-6 shadow-lg border border-gray-800 mb-10">
          <h3 className="text-lg font-semibold mb-4">Create New Token</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Staging Server"
              className="flex-1 px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <button
              onClick={createToken}
              disabled={SHOW_DEMO || loading}
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md hover:shadow-emerald-600/30 font-semibold disabled:opacity-50"
            >
              <PlusCircleIcon className="w-5 h-5" />
              {loading ? "Creating..." : "Generate Token"}
            </button>
          </div>

          {newToken && (
            <div className="mt-6 p-4 bg-[#12151c] border border-gray-700 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">
                Save this token now — you won’t be able to see it again.
              </p>
              <code className="block font-mono text-sm bg-gray-900 text-emerald-400 p-3 rounded-md break-all">
                {newToken}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newToken);
                  window.alert("Copied to clipboard!");
                }}
                className="mt-3 px-3 py-1.5 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
              >
                Copy Token
              </button>
            </div>
          )}
        </section>

        {/* Tokens Table */}
        <section>
          <h3 className="text-lg font-semibold mb-3">Active Tokens</h3>
          {tokens.length === 0 ? (
            <p className="text-gray-500 text-center py-12 rounded-xl border border-dashed border-gray-800 bg-[#131720]">
              No tokens yet. Create one above to get started.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#141922] shadow-lg">
              <table className="min-w-full text-left text-gray-300">
                <thead className="bg-[#10141b] text-xs uppercase tracking-wide border-b border-gray-800">
                  <tr>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Name</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Created</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Last Used</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Status</th>
                    <th className="py-3.5 px-5 font-semibold text-right text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {tokens.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-5 font-medium text-gray-100">{t.name}</td>
                      <td className="py-3 px-5 text-gray-400">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5 text-gray-400">
                        {t.lastUsed ? new Date(t.lastUsed).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-3 px-5">
                        {t.revoked ? (
                          <span className="text-red-400 font-semibold text-sm">Revoked</span>
                        ) : (
                          <span className="text-emerald-400 font-semibold text-sm">Active</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        {!t.revoked && (
                          <button
                            onClick={() => revokeToken(t.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            aria-label={`Revoke token ${t.name}`}
                          >
                            <TrashIcon className="w-5 h-5 inline-block" />
                          </button>
                        )}
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