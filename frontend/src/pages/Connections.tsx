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
const SHOW_DEMO = import.meta.env.VITE_ALLOW_DEMO_DB === "true";

export default function Connections() {
  const [connections, setConnections] = useState<any[]>([]);
  const [newConn, setNewConn] = useState({ name: "", dbType: "mysql", connectionUrl: "" });
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConn, setSelectedConn] = useState<any>(null);
  const navigate = useNavigate();
  const demoExists = connections.some((c) => c.name === "Demo Database");

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
    if (!newConn.name || !newConn.connectionUrl) {
      alert("⚠️ Please fill in all fields before adding a connection.");
      return;
    }
    await axios.post(`${API_URL}/connections`, {
      ...newConn,
      userId: "demo-user-1",
    });
    setNewConn({ name: "", dbType: "mysql", connectionUrl: "" });
    setTestStatus("idle");
    setTestMessage("");
    fetchConnections();
  }

  async function addDemoConnection() {
    try {
      await axios.post(`${API_URL}/connections`, {
        name: "Demo Database",
        dbType: "postgres",
        connectionUrl: import.meta.env.VITE_DEMO_DB_URL,
        userId: "demo-user-1",
      });
      fetchConnections();
    } catch (err: any) {
      console.error("❌ Failed to add demo connection:", err.message);
    }
  }

  async function testConnection() {
    if (!newConn.connectionUrl) {
      setTestStatus("error");
      setTestMessage("⚠️ Please enter a connection URL first.");
      return;
    }
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
    <div className="min-h-screen bg-[#0f1115] text-gray-100 font-sans">
      {/* Main */}
      <main className="max-w-6xl w-full px-10 py-12 mx-auto">
        <h2 className="text-2xl font-semibold text-gray-100 mb-8 select-none">
          Manage Connections
        </h2>

        {/* Connection Form */}
        <div className="space-y-6 mb-8">
          <div className="relative">
            <input
              type="text"
              id="connectionName"
              value={newConn.name}
              onChange={(e) => setNewConn({ ...newConn, name: e.target.value })}
              className="peer w-full px-4 py-3 border border-gray-700 rounded-lg text-gray-100 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
            />
            <label
              htmlFor="connectionName"
              className={`absolute left-4 text-gray-400 text-base transform transition-all select-none pointer-events-none ${
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
              className="peer w-full px-4 py-3 border border-gray-700 rounded-lg text-gray-100 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
            />
            <label
              htmlFor="connectionUrl"
              className={`absolute left-4 text-gray-400 text-base transform transition-all select-none pointer-events-none ${
                newConn.connectionUrl
                  ? "top-1 text-sm text-indigo-400"
                  : "top-1/2 -translate-y-1/2 text-base text-gray-500 peer-focus:top-1 peer-focus:text-sm peer-focus:text-indigo-400"
              }`}
            >
              Connection URL
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-4">
            <button
              onClick={testConnection}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm select-none"
            >
              <PowerIcon className="w-5 h-5" />
              Test Connection
            </button>
            <button
              onClick={addConnection}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm select-none"
            >
              <PlusCircleIcon className="w-5 h-5" />
              Add Connection
            </button>
            {SHOW_DEMO && (
              demoExists ? (
                <button
                  disabled
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-yellow-800 cursor-not-allowed opacity-60 text-black font-semibold shadow-sm select-none"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  Demo Connected
                </button>
              ) : (
                <button
                  onClick={addDemoConnection}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-semibold shadow-sm select-none"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  Connect Demo Database
                </button>
              )
            )}
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
        <div className="mt-12 mb-8">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 select-none">
            Saved Connections
          </h3>
          {connections.length === 0 ? (
            <p className="text-gray-500 text-center py-8 select-none">
              No connections yet.
            </p>
          ) : (
            <div>
              <table className="min-w-full text-left text-gray-300">
                <thead className="bg-transparent border-b border-gray-700 text-sm font-semibold text-gray-400 select-none">
                  <tr>
                    <th className="py-3 px-5">Name</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Created</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-700 cursor-default hover:bg-white/10"
                    >
                      <td className="py-3 px-5 font-medium text-gray-100">{c.name}</td>
                      <td className="py-3 px-5 text-gray-400">{c.dbType}</td>
                      <td className="py-3 px-5 text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5">
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
                      <td className="py-3 px-5 text-right flex justify-end gap-3">
                        <button
                          onClick={() => navigate(`/redactions/${c.id}`)}
                          className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors"
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
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 mx-4 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 select-none">
              Delete Connection
            </h3>
            <p className="text-gray-700 mb-6 select-none">
              Are you sure you want to delete the connection{" "}
              <span className="font-semibold text-gray-900">{selectedConn?.name}</span>?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedConn(null);
                }}
                className="px-6 py-2 rounded-md border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-500 transition-colors select-none"
              >
                Cancel
              </button>
              <button
                onClick={deleteConnection}
                className="px-6 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors select-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}