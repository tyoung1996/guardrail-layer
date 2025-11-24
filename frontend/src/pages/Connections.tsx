import axios from "../lib/axios";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircleIcon,
  Cog6ToothIcon,
  PowerIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "../auth/AuthProvider";

const API_URL = import.meta.env.VITE_API_URL;
const SHOW_DEMO_DB = import.meta.env.VITE_ALLOW_DEMO_DB === "true";
const SHOW_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

type ConnStatus = "active" | "down" | "unknown";

export default function Connections() {
  const { user, token } = useAuth();
  console.log(user)
  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-gray-200">
        Loading user…
      </div>
    );
  }
  const [connections, setConnections] = useState<any[]>([]);
  const [newConn, setNewConn] = useState({
    name: "",
    dbType: "mysql",
    connectionUrl: "",
    host: "",
    port: "",
    username: "",
    password: "",
    database: "",
    userId: ""
  });
  useEffect(() => {
    if (user?.userId) {
      setNewConn((prev) => ({ ...prev, userId: user.userId }));
    }
  }, [user]);
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConn, setSelectedConn] = useState<any>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const navigate = useNavigate();
  const demoExists = connections.some((c) => c.name === "Demo Database");

  async function fetchConnections() {
    try {
      const res = await axios.get(`${API_URL}/connections`);
      const data = Array.isArray(res.data) ? res.data : res.data.connections || [];
      setConnections(data);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error("❌ Failed to fetch connections:", err.message);
    }
  }

  async function addConnection() {
    if (SHOW_DEMO) {
      window.alert("Demo mode — adding new connections is disabled.");
      return;
    }
    // Updated validation logic
    if (!newConn.name) {
      alert("⚠️ Name is required.");
      return;
    }
    if (newConn.dbType === "sqlite") {
      if (!newConn.database) {
        alert("⚠️ SQLite requires a file path.");
        return;
      }
    } else if (
      !newConn.connectionUrl &&
      (
        !newConn.host ||
        !newConn.port ||
        !newConn.username ||
        !newConn.password ||
        !newConn.database
      )
    ) {
      alert("⚠️ Please fill either a connection URL or all structured fields.");
      return;
    }
    await axios.post(`${API_URL}/connections`, {
      ...newConn,
      port: newConn.port ? Number(newConn.port) : undefined,
      userId: user.userId,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setNewConn({
      name: "",
      dbType: "mysql",
      connectionUrl: "",
      host: "",
      port: "",
      username: "",
      password: "",
      database: "",
      userId: user.userId
    });
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
        userId: user.userId
      });
      fetchConnections();
    } catch (err: any) {
      console.error("❌ Failed to add demo connection:", err.message);
    }
  }

  async function testConnection() {
    // Validation for test
    if (!newConn.name) {
      setTestStatus("error");
      setTestMessage("⚠️ Name is required.");
      return;
    }
    if (newConn.dbType === "sqlite") {
      if (!newConn.database) {
        setTestStatus("error");
        setTestMessage("⚠️ SQLite requires a file path.");
        return;
      }
    } else if (
      !newConn.connectionUrl &&
      (
        !newConn.host ||
        !newConn.port ||
        !newConn.username ||
        !newConn.password ||
        !newConn.database
      )
    ) {
      setTestStatus("error");
      setTestMessage("⚠️ Please fill either a connection URL or all structured fields.");
      return;
    }
    setTestStatus("loading");
    setTestMessage("");
    try {
      const res = await axios.post(`${API_URL}/connections/test`, {
        ...newConn,
        port: newConn.port ? Number(newConn.port) : undefined,
        userId: user.userId,
      });
      if (res.data.ok) {
        if (res.data.warning) {
          setTestStatus("success");
          setTestMessage("⚠️ " + res.data.warning);
        } else {
          setTestStatus("success");
          setTestMessage("✅ Connection successful");
        }
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
    if (SHOW_DEMO) {
      window.alert("Demo mode — deleting connections is disabled.");
      return;
    }
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
    async function init() {
      await fetchConnections();
      if (SHOW_DEMO) {
        const exists = connections.some((c) => c.name === "Demo Database");
        const demoAdded = sessionStorage.getItem("demoAdded") === "true";
        if (!exists && !demoAdded) {
          await addDemoConnection();
          sessionStorage.setItem("demoAdded", "true");
        }
      }
    }
    init();
    const interval = setInterval(fetchConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  const prettyLastRefreshed = useMemo(() => {
    if (!lastRefreshedAt) return "—";
    return lastRefreshedAt.toLocaleTimeString();
  }, [lastRefreshedAt]);

  const statusBadge = (status: ConnStatus) => {
    if (status === "active") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
          <CheckCircleIcon className="w-4 h-4" />
          Active
        </span>
      );
    }
    if (status === "down") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 text-xs font-semibold">
          <XCircleIcon className="w-4 h-4" />
          Down
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-400/10 text-gray-400 text-xs font-semibold">
        <ClockIcon className="w-4 h-4 animate-pulse" />
        Creating…
      </span>
    );
  };

  const typeBadge = (dbType: string) => (
    <span className="inline-flex items-center px-2 py-1 rounded-md bg-slate-700 text-slate-200 text-xs font-semibold">
      {dbType?.toUpperCase() || "—"}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1115] via-[#141820] to-[#0f1115] text-gray-100 font-sans">
      {/* Demo Mode Banner */}
      {SHOW_DEMO && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-center py-3 font-medium">
          Demo Mode — You’re connected to a sample database. You can test new connections, but changes won’t be saved.
        </div>
      )}
      <main className="max-w-5xl mx-auto py-12 px-6 sm:px-10">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Database Connections</h2>
          <p className="text-gray-400 mt-2 text-sm">
            Securely connect, test, and manage your database integrations.
          </p>
        </div>

        {/* Form Card */}
        
        <section className="bg-[#1b1f28] rounded-xl p-6 shadow-lg border border-gray-800 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Name */}
            <div>
              <label htmlFor="connectionName" className="block text-sm font-medium text-gray-300 mb-1">
                Connection Name
              </label>
              <input
                id="connectionName"
                type="text"
                value={newConn.name}
                onChange={(e) => setNewConn({ ...newConn, name: e.target.value, userId: user.userId })}
                placeholder="e.g. Production Postgres"
                className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* Type */}
            <div>
              <label htmlFor="dbType" className="block text-sm font-medium text-gray-300 mb-1">
                Database Type
              </label>
              <select
                id="dbType"
                value={newConn.dbType}
                onChange={(e) => setNewConn({ ...newConn, dbType: e.target.value, userId: user.userId })}
                className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mssql">MSSQL</option>
                <option value="sqlite">SQLite</option>
              </select>
            </div>

            {/* URL */}
            {newConn.dbType !== "sqlite" && (
              <div className="md:col-span-3">
                <details className="group bg-[#12151c] border border-gray-700 rounded-lg p-4">
                  <summary className="cursor-pointer text-gray-300 font-medium flex items-center justify-between">
                    Advanced Options
                    <span className="text-xs text-gray-500 group-open:hidden">Show</span>
                    <span className="text-xs text-gray-500 hidden group-open:inline">Hide</span>
                  </summary>

                  <div className="mt-4">
                    <label htmlFor="connectionUrl" className="block text-sm font-medium text-gray-300 mb-1">
                      Connection URL (optional)
                    </label>
                    <input
                      id="connectionUrl"
                      type="text"
                      value={newConn.connectionUrl}
                      onChange={(e) => setNewConn({ ...newConn, connectionUrl: e.target.value, userId: user.userId })}
                      placeholder="postgresql://user:pass@host:5432/dbname"
                      className="w-full px-3 py-2 rounded-lg bg-[#0d0f14] border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      If provided, this will override Host / Port / Username / Password / Database fields.
                    </p>
                  </div>
                </details>
              </div>
            )}

            {/* Structured Fields */}
            {newConn.dbType !== "sqlite" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Host</label>
                  <input
                    type="text"
                    value={newConn.host}
                    onChange={(e) => setNewConn({ ...newConn, host: e.target.value })}
                    placeholder="localhost or 127.0.0.1"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Port</label>
                  <input
                    type="text"
                    value={newConn.port}
                    onChange={(e) => setNewConn({ ...newConn, port: e.target.value })}
                    placeholder="3306 / 5432 / 1433"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                  <input
                    type="text"
                    value={newConn.username}
                    onChange={(e) => setNewConn({ ...newConn, username: e.target.value })}
                    placeholder="database user"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                  <input
                    type="password"
                    value={newConn.password}
                    onChange={(e) => setNewConn({ ...newConn, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-300 mb-1">Database Name</label>
                  <input
                    type="text"
                    value={newConn.database}
                    onChange={(e) => setNewConn({ ...newConn, database: e.target.value })}
                    placeholder="dbname"
                    className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                  />
                </div>
              </>
            )}
            {/* SQLite-specific field */}
            {newConn.dbType === "sqlite" && (
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-300 mb-1">SQLite File Path</label>
                <input
                  type="text"
                  value={newConn.database}
                  onChange={(e) => setNewConn({ ...newConn, database: e.target.value })}
                  placeholder="/path/to/db.sqlite"
                  className="w-full px-3 py-2 rounded-lg bg-[#12151c] border border-gray-700 text-gray-100"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={testConnection}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md hover:shadow-indigo-600/30 font-semibold"
            >
              <PowerIcon className="w-5 h-5" />
              Test Connection
              {testStatus === "loading" && (
                <span className="ml-1 inline-block w-4 h-4 border-2 border-t-transparent border-white/70 rounded-full animate-spin" />
              )}
            </button>

            <button
  onClick={addConnection}
  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md hover:shadow-emerald-600/30 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
  disabled={SHOW_DEMO}
  title={SHOW_DEMO ? "Disabled in demo mode" : ""}
>
              <PlusCircleIcon className="w-5 h-5" />
              Add Connection
            </button>

            {SHOW_DEMO_DB && (
              demoExists ? (
                <button
                  disabled
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-yellow-800/60 cursor-not-allowed text-black font-semibold"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                  Demo Connected
                </button>
              ) : (
                <button
                  onClick={addDemoConnection}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-400 transition-all text-black font-semibold shadow-md hover:shadow-yellow-500/30"
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
              className={`mt-4 text-sm font-medium select-none ${
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
        </section>
        

        {/* Saved Connections */}
        <section aria-labelledby="saved-connections">
          <div className="flex items-center justify-between mb-3">
            <h3 id="saved-connections" className="text-lg font-semibold text-gray-100">
              Saved Connections
            </h3>
            <div className="text-xs text-gray-400">
              Last refreshed: <span className="font-mono">{prettyLastRefreshed}</span>
            </div>
          </div>

          {connections.length === 0 ? (
            <p className="text-gray-500 text-center py-12 select-none rounded-xl border border-dashed border-gray-800 bg-[#131720]">
              No connections yet. Add one above to get started.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#141922] shadow-lg">
              <table className="min-w-full text-left text-gray-300">
                <thead className="bg-[#10141b] text-xs uppercase tracking-wide border-b border-gray-800">
                  <tr>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Name</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Type</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Created</th>
                    <th className="py-3.5 px-5 font-semibold text-gray-400">Status</th>
                    <th className="py-3.5 px-5 font-semibold text-right text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {connections.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3 px-5 font-medium text-gray-100">
                        {c.name}
                        {c.name === "Demo Database" && (
                          <span className="ml-2 text-xs text-amber-400">(Demo)</span>
                        )}
                      </td>
                      <td className="py-3 px-5">{typeBadge(c.dbType)}</td>
                      <td className="py-3 px-5 text-gray-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-5">
                        {statusBadge((c.status || "unknown") as ConnStatus)}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => navigate(`/redactions/${c.id}`)}
                            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium shadow-sm hover:bg-indigo-500 transition-colors"
                          >
                            Configure Global Rules
                          </button>
                          <button
                            onClick={() => {
                              setSelectedConn(c);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            aria-label={`Delete connection ${c.name}`}
                            disabled={SHOW_DEMO}
                            title={SHOW_DEMO ? "Disabled in demo mode" : ""}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1b1f28] border border-gray-700 rounded-xl shadow-2xl max-w-md w-full p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">
              Delete Connection
            </h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-gray-100">{selectedConn?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedConn(null);
                }}
                className="px-5 py-2 rounded-md border border-gray-600 text-gray-200 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteConnection}
                className="px-5 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white font-semibold shadow hover:shadow-red-500/30 transition-all"
                disabled={SHOW_DEMO}
                title={SHOW_DEMO ? "Disabled in demo mode" : ""}
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