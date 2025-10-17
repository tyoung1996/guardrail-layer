import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircleIcon,
  Cog6ToothIcon,
  PowerIcon,
} from "@heroicons/react/24/solid";
import { TrashIcon } from "@heroicons/react/24/outline";

const API_URL = import.meta.env.VITE_API_URL;

export default function Connections() {
  const [connections, setConnections] = useState<any[]>([]);
  const [newConn, setNewConn] = useState({ name: "", dbType: "mysql", connectionUrl: "" });
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConn, setSelectedConn] = useState<any>(null);
  const navigate = useNavigate();

  async function fetchConnections() {
    try {
      const res = await axios.get(`${API_URL}/connections`);
      const data = Array.isArray(res.data) ? res.data : res.data.connections || [];
      setConnections(data);
    } catch (err: any) {
      console.error("❌ Failed to fetch connections:", err.message);
    }
  }

  async function addConnection() {
    await axios.post(`${API_URL}/connections`, {
      ...newConn,
      userId: "demo-user-1",
    });
    setNewConn({ name: "", dbType: "mysql", connectionUrl: "" });
    setTestStatus("idle");
    setTestMessage("");
    fetchConnections();
  }

  async function testConnection() {
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await axios.post(`${API_URL}/connections/test`, {
        dbType: newConn.dbType,
        connectionUrl: newConn.connectionUrl,
      });
      if (res.data.ok) {
        setTestStatus("success");
        setTestMessage("✅ Connection successful");
      } else {
        setTestStatus("error");
        setTestMessage(res.data.error || "❌ Connection failed");
      }
    } catch (err: any) {
      setTestStatus("error");
      setTestMessage(err.response?.data?.error || "❌ Connection failed");
    }
  }

  async function deleteConnection() {
    if (!selectedConn) return;
    try {
      await axios.delete(`${API_URL}/connections/${selectedConn.id}`);
      setShowDeleteModal(false);
      setSelectedConn(null);
      fetchConnections();
    } catch (err: any) {
      console.error("❌ Failed to delete connection:", err.message);
    }
  }

  useEffect(() => {
    fetchConnections();
    const interval = setInterval(fetchConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f1115] via-[#151821] to-[#0e1014] text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-lg bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-blue-900/30 border-b border-white/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Cog6ToothIcon className="w-6 h-6 text-indigo-400" />
            <h1 className="text-2xl font-semibold tracking-tight text-white select-none">
              Guardrail Layer
            </h1>
          </div>
          <span className="text-sm text-gray-400 select-none">Database Guardrail System</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-full max-w-3xl rounded-3xl backdrop-blur-3xl bg-white/10 border border-white/20 shadow-2xl p-12">
          <h2 className="text-4xl font-extrabold text-center bg-gradient-to-r from-indigo-400 via-purple-400 to-sky-400 bg-clip-text text-transparent mb-12 select-none">
            Manage Connections
          </h2>

          {/* Connection Form */}
          <div className="space-y-8 mb-12">
            <div className="relative">
              <input
                type="text"
                id="connectionName"
                value={newConn.name}
                onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
                className="peer w-full px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              />
              <label
                htmlFor="connectionName"
                className={`absolute left-5 text-gray-400 text-base transform transition-all select-none pointer-events-none ${
                  newConn.name
                    ? "top-1 text-sm text-indigo-400"
                    : "top-1/2 -translate-y-1/2 text-base text-gray-500 peer-focus:top-1 peer-focus:text-sm peer-focus:text-indigo-400"
                }`}
              >
                Connection Name
              </label>
            </div>

            <div className="relative">
              <input
                type="text"
                id="connectionUrl"
                value={newConn.connectionUrl}
                onChange={(e) => setNewConn({ ...newConn, connectionUrl: e.target.value })}
                className="peer w-full px-5 py-4 bg-white/5 border border-white/20 rounded-2xl text-gray-100 focus:outline-none focus:ring-4 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              />
              <label
                htmlFor="connectionUrl"
                className={`absolute left-5 text-gray-400 text-base transform transition-all select-none pointer-events-none ${
                  newConn.connectionUrl
                    ? "top-1 text-sm text-indigo-400"
                    : "top-1/2 -translate-y-1/2 text-base text-gray-500 peer-focus:top-1 peer-focus:text-sm peer-focus:text-indigo-400"
                }`}
              >
                Connection URL
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-6">
              <button
                onClick={testConnection}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-indigo-900/50 transition-transform transform hover:scale-[1.04] active:scale-95 select-none"
              >
                <PowerIcon className="w-5 h-5" />
                Test Connection
              </button>
              <button
                onClick={addConnection}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-xl shadow-emerald-900/50 transition-transform transform hover:scale-[1.04] active:scale-95 select-none"
              >
                <PlusCircleIcon className="w-5 h-5" />
                Add Connection
              </button>
            </div>

            {/* Test status */}
            {testStatus !== "idle" && (
              <div
                className={`text-center font-medium select-none ${
                  testStatus === "loading"
                    ? "text-blue-400"
                    : testStatus === "success"
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {testStatus === "loading" ? "⏳ Testing connection..." : testMessage}
              </div>
            )}
          </div>

          {/* Saved Connections */}
          <div>
            <h3 className="text-xl font-semibold text-gray-100 mb-6 select-none">
              Saved Connections
            </h3>
            {connections.length === 0 ? (
              <p className="text-gray-500 text-center py-10 bg-white/5 border border-white/20 rounded-3xl select-none">
                No connections yet.
              </p>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/5 backdrop-blur-lg shadow-lg">
                <table className="min-w-full text-left text-gray-300 rounded-3xl">
                  <thead className="bg-white/10 border-b border-white/20 text-sm font-semibold text-gray-400 select-none">
                    <tr>
                      <th className="py-4 px-6">Name</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Created</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connections.map((c, i) => (
                      <tr
                        key={c.id}
                        className={`transition-colors border-b border-white/10 last:border-0 cursor-default ${
                          i % 2 === 0 ? "bg-white/5" : "bg-white/10"
                        } hover:bg-gradient-to-r hover:from-indigo-700/40 hover:via-purple-700/30 hover:to-blue-700/40`}
                      >
                        <td className="py-4 px-6 font-medium text-white">{c.name}</td>
                        <td className="py-4 px-6 text-gray-400">{c.dbType}</td>
                        <td className="py-4 px-6 text-gray-500">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6">
                          {c.status === "active" && (
                            <div className="flex items-center gap-2 text-emerald-400 font-semibold select-none">
                              <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span> Active
                            </div>
                          )}
                          {c.status === "down" && (
                            <div className="flex items-center gap-2 text-red-400 font-semibold select-none">
                              <span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span> Down
                            </div>
                          )}
                          {c.status === "unknown" && (
                            <div className="flex items-center gap-2 text-gray-400 font-semibold select-none">
                              <span className="w-3 h-3 rounded-full bg-gray-400 inline-block animate-pulse"></span> Creating Connection...
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right flex justify-end gap-3">
                          <button
                            onClick={() => navigate(`/redactions/${c.id}`)}
                            className="px-3 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-sm font-medium shadow-md transition"
                          >
                            Configure
                          </button>
                          <button
                            onClick={() => {
                              setSelectedConn(c);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm transition-opacity">
          <div className="bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-8 mx-4 text-center">
            <h3 className="text-xl font-semibold text-white mb-4 select-none">
              Delete Connection
            </h3>
            <p className="text-gray-300 mb-6 select-none">
              Are you sure you want to delete the connection{" "}
              <span className="font-semibold text-indigo-400">{selectedConn?.name}</span>?
            </p>
            <div className="flex justify-center gap-6">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedConn(null);
                }}
                className="px-6 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors select-none"
              >
                Cancel
              </button>
              <button
                onClick={deleteConnection}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors select-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 border-t border-white/10 text-center text-sm text-gray-500 backdrop-blur-md bg-white/5 select-none">
        © {new Date().getFullYear()} Guardrail Layer — Built for Secure AI Data Access
      </footer>
    </div>
  );
}