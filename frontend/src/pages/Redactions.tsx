import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import React from "react";

const API_URL = import.meta.env.VITE_API_URL;

interface Rule {
  id: string;
  connectionId: string;
  tableName: string;
  columnName: string;
  ruleType: "REDACT" | "MASK_EMAIL" | "REMOVE" | "HASH" | "EXPOSE";
  replacementText?: string;
  pattern?: string;
  role?: string;
}

interface Column {
  name: string;
  table: string;
}

interface Metadata {
  description: string;
  notes: string;
  tags: string[]; // change to array
}

export default function Redactions() {
  const { connectionId } = useParams();
  const [rules, setRules] = useState<Rule[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});
  const [showRemovedTables, setShowRemovedTables] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, Metadata>>({});

  // Tag input state for each table (for controlled input)
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const toggleTable = (table: string) => {
    setCollapsedTables((prev) => {
      const newCollapsed = { ...prev, [table]: !prev[table] };
      // If expanding, fetch metadata if not already loaded
      if (!newCollapsed[table] && !metadata[table]) {
        fetchMetadata(table);
      }
      return newCollapsed;
    });
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
    try {
      const [rulesRes, schemaRes] = await Promise.all([
        axios.get(`${API_URL}/redactions/${connectionId}`),
        axios.get(`${API_URL}/schema/${connectionId}`)
      ]);
      setRules(rulesRes.data);
      setColumns(
        Array.isArray(schemaRes.data)
          ? schemaRes.data
          : schemaRes.data.schema || schemaRes.data.columns || []
      );
    } catch (err) {
      setError("Failed to load data. Please try again later.");
    } finally {
      setLoading(false);
    }
    }
    fetchData();
  }, [connectionId]);

  const fetchMetadata = async (tableName: string) => {
    try {
      const res = await axios.get(`${API_URL}/metadata/${connectionId}/${tableName}`);
      setMetadata((prev) => ({
        ...prev,
        [tableName]: {
          description: res.data.description || "",
          notes: res.data.notes || "",
          tags: Array.isArray(res.data.tags)
            ? res.data.tags
            : typeof res.data.tags === "string"
              ? res.data.tags.split(",").map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0)
              : [],
        },
      }));
      setTagInputs((prev) => ({
        ...prev,
        [tableName]: "",
      }));
      setError(null);
    } catch {
      setMetadata((prev) => ({
        ...prev,
        [tableName]: { description: "", notes: "", tags: [] },
      }));
      setTagInputs((prev) => ({
        ...prev,
        [tableName]: "",
      }));
      setError("Failed to load metadata. Please try again later.");
    }
  };

  const saveMetadata = async (tableName: string) => {
    try {
      const meta = metadata[tableName];
      await axios.post(`${API_URL}/metadata/${connectionId}/${tableName}`, {
        description: meta.description,
        notes: meta.notes,
        tags: (meta.tags || []).join(","),
      });
      setError(null);
    } catch {
      setError("Failed to save metadata. Please try again.");
    }
  };

  const handleRuleChange = async (col: Column, newRuleType: Rule["ruleType"]) => {
    try {
      await axios.post(`${API_URL}/redactions`, {
        connectionId,
        tableName: col.table,
        columnName: col.name,
        ruleType: newRuleType,
      });
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
      setError(null);
    } catch {
      setError("Failed to update rule. Please try again.");
    }
  };

  // Helper for updating rule fields (replacementText, role)
  const updateRule = async (col: Column, updatedFields: Partial<Pick<Rule, "replacementText" | "role">>) => {
    try {
      await axios.post(`${API_URL}/redactions/update`, {
        connectionId,
        tableName: col.table,
        columnName: col.name,
        ...updatedFields,
      });
      // Refetch rules
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
      setError(null);
    } catch {
      setError("Failed to update rule. Please try again.");
    }
  };

  // --- Global Regex Rules Modal State ---
  type GlobalRule = {
    id?: string;
    name: string;
    pattern: string;
    replacement: string;
    role?: string;
  };
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalRules, setGlobalRules] = useState<GlobalRule[]>([]);
  const [globalModalLoading, setGlobalModalLoading] = useState(false);
  const [globalModalError, setGlobalModalError] = useState<string | null>(null);
  const [newGlobalRule, setNewGlobalRule] = useState<GlobalRule>({ name: "", pattern: "", replacement: "", role: "" });
  // Track deleted global rule IDs for backend deletion
  const [deletedGlobalRuleIds, setDeletedGlobalRuleIds] = useState<string[]>([]);
  // --- Regex Builder Modal State ---
  const [regexTestInput, setRegexTestInput] = useState("");
  const [regexTestOutput, setRegexTestOutput] = useState("");
  const [showRegexBuilder, setShowRegexBuilder] = useState(false);

  const fetchGlobalRules = async () => {
    setGlobalModalLoading(true);
    setGlobalModalError(null);
    try {
      const res = await axios.get(`${API_URL}/redactions/global`);
      setGlobalRules(res.data || []);
    } catch {
      setGlobalModalError("Failed to load global regex rules.");
    } finally {
      setGlobalModalLoading(false);
    }
  };

  const handleOpenGlobalModal = () => {
    console.log("Opening global modal");
    setShowGlobalModal(true);
    fetchGlobalRules();
    setNewGlobalRule({ name: "", pattern: "", replacement: "", role: "" });
    setGlobalModalError(null);
  };

  const handleAddGlobalRule = () => {
    if (
      !newGlobalRule.name.trim() ||
      !newGlobalRule.pattern.trim()
    ) return;
    setGlobalRules((prev) => [
      ...prev,
      { ...newGlobalRule }
    ]);
    setNewGlobalRule({ name: "", pattern: "", replacement: "", role: "" });
  };

  const handleDeleteGlobalRule = (idx: number) => {
    setGlobalRules((prev) => {
      const rule = prev[idx];
      if (rule?.id) {
        setDeletedGlobalRuleIds((prevIds) => [...prevIds, rule.id!]);
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleEditGlobalRule = (idx: number, field: keyof GlobalRule, value: string) => {
    setGlobalRules((prev) =>
      prev.map((rule, i) =>
        i === idx ? { ...rule, [field]: value } : rule
      )
    );
  };

  const handleSaveGlobalRules = async () => {
    setGlobalModalLoading(true);
    setGlobalModalError(null);
    try {
      // First, delete any deleted rules on the backend
      for (const id of deletedGlobalRuleIds) {
        try {
          await axios.delete(`${API_URL}/redactions/global/${id}`);
        } catch (err) {
          console.warn("Failed to delete rule", id, err);
        }
      }
      setDeletedGlobalRuleIds([]);

      // Post one-by-one — backend expects a single rule object per request
      for (const rule of globalRules) {
        const payload = {
          name: rule.name?.trim() ?? "",
          pattern: rule.pattern?.trim() ?? "",
          replacement: rule.replacement ?? "",
          role: rule.role ?? "",
        };
        // Skip invalid rows (UI already guards, but double-check here)
        if (!payload.name || !payload.pattern) continue;

        await axios.post(`${API_URL}/redactions/global`, payload);
      }

      // Close the modal and refresh the list
      setShowGlobalModal(false);
      await fetchGlobalRules();
    } catch (e) {
      setGlobalModalError("Failed to save global regex rules.");
    } finally {
      setGlobalModalLoading(false);
    }
  };

  const groupedColumns = columns.reduce((acc, col) => {
    if (!acc[col.table]) acc[col.table] = [];
    acc[col.table].push(col);
    return acc;
  }, {} as Record<string, Column[]>);

  useEffect(() => {
    const collapsed: Record<string, boolean> = {};
    Object.keys(groupedColumns).forEach((table) => (collapsed[table] = true));
    setCollapsedTables(collapsed);
  }, [columns]);

  const handleTableRuleChange = async (tableName: string, newRuleType: Rule["ruleType"]) => {
    try {
      await axios.post(`${API_URL}/redactions/table`, {
        connectionId,
        tableName,
        ruleType: newRuleType,
      });
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
      setError(null);
    } catch {
      setError("Failed to update table rule. Please try again.");
    }
  };

  return (
    <>
      {/* --- Global Regex Modal UI (moved outside main container) --- */}
      {showGlobalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#1e1f25] rounded-lg shadow-lg w-full max-w-3xl p-8 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-2xl"
              onClick={() => {
                console.log("Closing global modal");
                setShowGlobalModal(false);
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Manage Global Regex Rules</h2>
            {globalModalError && (
              <div className="mb-4 text-red-400 font-semibold">{globalModalError}</div>
            )}
            {globalModalLoading ? (
              <div className="text-center text-gray-400 py-8">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="w-full table-auto text-base divide-y divide-gray-700 border-collapse">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-300 font-semibold">Name</th>
                        <th className="px-4 py-2 text-left text-gray-300 font-semibold">
                          Pattern
                  
                        </th>
                        <th className="px-4 py-2 text-left text-gray-300 font-semibold">Replacement</th>
                        <th className="px-4 py-2 text-left text-gray-300 font-semibold">Role</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
      {/* --- Regex Smart Builder Modal --- */}
      {showRegexBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#1e1f25] rounded-lg shadow-lg w-full max-w-lg p-8 relative">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-2xl"
              onClick={() => setShowRegexBuilder(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Regex Smart Builder</h2>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm"
                  onClick={() => setNewGlobalRule(r => ({ ...r, pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" }))}
                  type="button"
                >Email</button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm"
                  onClick={() => setNewGlobalRule(r => ({ ...r, pattern: "\\b\\d{3}[-.]?\\d{2}[-.]?\\d{4}\\b" }))}
                  type="button"
                >SSN</button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm"
                  onClick={() => setNewGlobalRule(r => ({ ...r, pattern: "\\b(?:\\d[ -]*?){13,16}\\b" }))}
                  type="button"
                >Credit Card</button>
                <button
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1 rounded text-sm"
                  onClick={() => setNewGlobalRule(r => ({ ...r, pattern: "\\b\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b" }))}
                  type="button"
                >Phone</button>
              </div>
              <div className="mb-2">
                <label className="block text-gray-300 font-semibold mb-1" htmlFor="regex-pattern-builder">
                  Pattern
                </label>
                <input
                  id="regex-pattern-builder"
                  type="text"
                  className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full mb-2"
                  value={newGlobalRule.pattern}
                  onChange={e => setNewGlobalRule(r => ({ ...r, pattern: e.target.value }))}
                  placeholder="Regex pattern"
                />
              </div>
              <div className="mb-2">
                <label className="block text-gray-300 font-semibold mb-1" htmlFor="regex-test-input">
                  Test Input
                </label>
                <textarea
                  id="regex-test-input"
                  className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full mb-2"
                  rows={3}
                  value={regexTestInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRegexTestInput(val);
                    try {
                      const regex = new RegExp(newGlobalRule.pattern, "gi");
                      const highlighted = val.replace(regex, match => `[[${match}]]`);
                      setRegexTestOutput(highlighted);
                    } catch {
                      setRegexTestOutput("⚠️ Invalid regex syntax");
                    }
                  }}
                  placeholder="Paste sample text to test your regex"
                />
              </div>
              <div className="mb-2">
                <label className="block text-gray-300 font-semibold mb-1">
                  Preview
                </label>
                <div className="bg-[#25262c] text-gray-100 px-3 py-2 rounded min-h-[48px] whitespace-pre-line font-mono text-sm overflow-x-auto border border-gray-700">
                  {(() => {
                    // Highlight [[...]] with span
                    if (regexTestOutput.startsWith("⚠️")) {
                      return <span className="text-yellow-400">{regexTestOutput}</span>;
                    }
                    // Replace [[match]] with highlighted span
                    const parts = regexTestOutput.split(/\[\[|\]\]/);
                    let highlight = false;
                    return parts.map((part, idx) => {
                      if (idx === 0 && regexTestOutput.startsWith('[[')) highlight = true;
                      if (idx === 0) return part;
                      highlight = !highlight;
                      if (highlight) {
                        return <span key={idx} className="bg-yellow-700/60 text-yellow-200 rounded px-1">{part}</span>;
                      } else {
                        return part;
                      }
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button
                className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-6 py-2 rounded-md shadow"
                onClick={() => setShowRegexBuilder(false)}
              >Close</button>
            </div>
          </div>
        </div>
      )}
                    <tbody>
                      {globalRules.map((rule, idx) => (
                        <tr key={idx} className="hover:bg-gray-800/60 transition-all">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                              value={rule.name}
                              onChange={e => handleEditGlobalRule(idx, "name", e.target.value)}
                              placeholder="Rule name"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                              value={rule.pattern}
                              onChange={e => handleEditGlobalRule(idx, "pattern", e.target.value)}
                              placeholder="Regex pattern"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                              value={rule.replacement}
                              onChange={e => handleEditGlobalRule(idx, "replacement", e.target.value)}
                              placeholder="Replacement"
                            />
                          </td>
                          <td className="px-4 py-2">
                          <select
                            className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                            value={rule.role || ""}
                            onChange={e => handleEditGlobalRule(idx, "role", e.target.value)}
                            disabled={true}
                          >
                            <option value="">(none)</option>
                            <option value="admin">admin</option>
                            <option value="viewer">viewer</option>
                          </select>
                          </td>
                          <td className="px-2 py-2">
                            <button
                              className="text-red-400 hover:text-red-600 text-lg px-2"
                              onClick={() => handleDeleteGlobalRule(idx)}
                              aria-label="Delete"
                            >×</button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                            value={newGlobalRule.name}
                            onChange={e => setNewGlobalRule(r => ({ ...r, name: e.target.value }))}
                            placeholder="Rule name"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                            value={newGlobalRule.pattern}
                            onChange={e => setNewGlobalRule(r => ({ ...r, pattern: e.target.value }))}
                            placeholder="Regex pattern"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                            value={newGlobalRule.replacement}
                            onChange={e => setNewGlobalRule(r => ({ ...r, replacement: e.target.value }))}
                            placeholder="Replacement"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full"
                            value={newGlobalRule.role || ""}
                            onChange={e => setNewGlobalRule(r => ({ ...r, role: e.target.value }))}
                            disabled={true}
                          >
                            <option value="">(none)</option>
                            <option value="admin">admin</option>
                            <option value="viewer">viewer</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <button
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1 rounded-md text-sm font-semibold shadow"
                            onClick={handleAddGlobalRule}
                            disabled={!newGlobalRule.name.trim() || !newGlobalRule.pattern.trim()}
                          >Add</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 px-6 py-2 rounded-md shadow"
                    onClick={() => {
                      console.log("Closing global modal");
                      setShowGlobalModal(false);
                    }}
                    disabled={globalModalLoading}
                  >Cancel</button>
                  <button
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-md shadow font-semibold"
                    onClick={handleSaveGlobalRules}
                    disabled={globalModalLoading}
                  >Save</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="min-h-screen w-full bg-gradient-to-br from-[#1a1b1f] via-[#13141a] to-[#0f1014] text-gray-200">
        <div className="w-full px-12 py-12 mx-auto">
        <h1 className="text-4xl font-extrabold mb-8 text-gray-300 text-center tracking-wide">Redaction Rules</h1>

        {error && (
          <div className="mb-6 text-red-400 font-semibold text-center" role="alert">
            {error}
          </div>
        )}


        {loading ? (
          <p className="text-center text-gray-300">Loading rules and schema...</p>
        ) : columns.length === 0 ? (
          <p className="text-center text-gray-300">No columns found for this connection.</p>
        ) : (
          <>
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2">
              <button
                onClick={handleOpenGlobalModal}
                className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2 rounded-md shadow font-semibold"
              >
                Manage Global Regex Rules
              </button>
              <button
                onClick={() => setShowRemovedTables(!showRemovedTables)}
                className="bg-[#25262c] hover:bg-[#1e1f25] text-gray-200 px-4 py-2 rounded-md shadow transition"
              >
                {showRemovedTables ? "Hide Removed Tables" : "Show Removed Tables"}
              </button>
            </div>
            <div className="overflow-x-auto border-t border-gray-800 bg-gray-800/60 shadow-inner w-full px-12 py-8 rounded-none">
              <table className="w-full table-auto text-base divide-y divide-gray-700 border-collapse">
                <thead className="bg-gray-900/50 border-b border-gray-800">
                  <tr>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[30%]"
                    >
                      Column
                    </th>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[20%]"
                    >
                      Rule
                    </th>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[20%]"
                    >
                      Replacement Text
                    </th>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[15%]"
                    >
                      Role
                    </th>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[15%]"
                    >
                      Action
                    </th>
                    <th
                      scope="col"
                      className="px-10 py-3 text-left text-gray-300 font-semibold tracking-wide w-[15%]"
                    >
                    </th>
                  </tr>
                </thead>
                {Object.entries(groupedColumns).map(([tableName, cols]) => {
                  const allRemoved = cols.every(
                    (col) => rules.find((r) => r.columnName === col.name && r.ruleType === "REMOVE")
                  );
                  if (allRemoved && !showRemovedTables) return null;
                  const isCollapsed = collapsedTables[tableName];
                  return (
                    <React.Fragment key={tableName}>
                      <tr className="bg-[#1e1f25] hover:bg-[#25262c] text-gray-200 font-semibold uppercase tracking-wide text-base rounded-md shadow-md transition-all duration-300 !my-0 border-b border-gray-800/70">
                        <td colSpan={5} className="px-8 py-2">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-lg font-bold">{tableName}</span>
                            <div className="flex gap-3">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await handleTableRuleChange(tableName, "REMOVE");
                                }}
                                className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-md text-sm font-semibold shadow-md hover:shadow-lg transition-all"
                              >
                                Remove All Columns
                              </button>
                              <span
                                onClick={() => toggleTable(tableName)}
                                className="text-gray-300 text-sm bg-gray-800/60 hover:bg-gray-700/70 px-5 py-2 rounded-md shadow-inner cursor-pointer transition whitespace-nowrap"
                              >
                                {isCollapsed ? "▶ Show Columns" : "▼ Hide Columns"}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      <tbody
                        className={`bg-gray-900/20 transition-all duration-500 ease-in-out overflow-hidden`}
                        style={{
                          display: isCollapsed ? "none" : "table-row-group",
                          transition: "all 0.35s ease-in-out",
                          margin: "0",
                          padding: "0",
                          height: isCollapsed ? "0" : "auto",
                        }}
                      >
                        {!isCollapsed && (
                          <tr>
                            <td colSpan={5} className="!px-0" style={{ paddingLeft: 0, paddingRight: 0 }}>
                              <div
                                className="bg-[#25262c] rounded-lg p-6 mb-6 shadow-inner flex flex-col gap-4 transition-opacity duration-500 ease-in-out w-full max-w-none col-span-full"
                                style={{
                                  width: "100%",
                                  gridColumn: "1 / -1",
                                  marginLeft: 0,
                                  marginRight: 0,
                                }}
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                                  <label className="text-gray-300 font-semibold w-full md:w-32" htmlFor={`${tableName}-description`}>Description:</label>
                                  <textarea
                                    id={`${tableName}-description`}
                                    className="flex-grow bg-gray-900/40 text-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    rows={2}
                                    value={metadata[tableName]?.description || ""}
                                    onChange={(e) =>
                                      setMetadata((prev) => ({
                                        ...prev,
                                        [tableName]: {
                                          ...prev[tableName],
                                          description: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                                  <label className="text-gray-300 font-semibold w-full md:w-32" htmlFor={`${tableName}-notes`}>Notes:</label>
                                  <textarea
                                    id={`${tableName}-notes`}
                                    className="flex-grow bg-gray-900/40 text-gray-200 rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    rows={2}
                                    value={metadata[tableName]?.notes || ""}
                                    onChange={(e) =>
                                      setMetadata((prev) => ({
                                        ...prev,
                                        [tableName]: {
                                          ...prev[tableName],
                                          notes: e.target.value,
                                        },
                                      }))
                                    }
                                  />
                                </div>
                                <div className="flex flex-col md:flex-row md:items-center md:gap-6">
                                  <label className="text-gray-300 font-semibold w-full md:w-32" htmlFor={`${tableName}-tags`}>Tags:</label>
                                  <div className="flex-grow">
                                    <div
                                      className="flex flex-wrap items-center gap-y-2 gap-x-0 bg-gray-900/40 rounded-md px-3 py-2 min-h-[42px] transition-all"
                                      style={{ minHeight: 42 }}
                                      onClick={() => {
                                        // Focus the input when clicking container
                                        const el = document.getElementById(`${tableName}-tags-input`);
                                        if (el) (el as HTMLInputElement).focus();
                                      }}
                                    >
                                      {metadata[tableName]?.tags?.map((tag, tagIdx) => (
                                        <span
                                          key={tag + tagIdx}
                                          className="bg-[#1e1f25] text-gray-200 px-2 py-1 rounded-full mr-2 mb-2 flex items-center gap-1 animate-fadein"
                                          style={{
                                            animation: "fadein 0.2s",
                                            transition: "opacity 0.2s, transform 0.2s",
                                          }}
                                        >
                                          <span>{tag}</span>
                                          <button
                                            type="button"
                                            aria-label={`Remove tag ${tag}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMetadata((prev) => ({
                                                ...prev,
                                                [tableName]: {
                                                  ...prev[tableName],
                                                  tags: prev[tableName].tags.filter((_, i) => i !== tagIdx),
                                                },
                                              }));
                                            }}
                                            className="ml-1 text-gray-300 hover:text-red-400 focus:outline-none"
                                            style={{
                                              background: "none",
                                              border: "none",
                                              fontWeight: "bold",
                                              fontSize: "1rem",
                                              lineHeight: "1",
                                              cursor: "pointer",
                                              padding: 0,
                                            }}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ))}
                                      <input
                                        id={`${tableName}-tags-input`}
                                        type="text"
                                        className="bg-transparent text-gray-200 focus:outline-none min-w-[50px] flex-1 py-1"
                                        style={{ outline: "none", border: "none" }}
                                        value={tagInputs[tableName] || ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          // If user types comma, split and add tags
                                          if (val.includes(",")) {
                                            const parts = val.split(",");
                                            const newTags = parts
                                              .map((t) => t.trim())
                                              .filter((t) => t.length > 0);
                                            if (newTags.length > 0) {
                                              setMetadata((prev) => ({
                                                ...prev,
                                                [tableName]: {
                                                  ...prev[tableName],
                                                  tags: [
                                                    ...(prev[tableName]?.tags || []),
                                                    ...newTags,
                                                  ],
                                                },
                                              }));
                                            }
                                            setTagInputs((prev) => ({
                                              ...prev,
                                              [tableName]: "",
                                            }));
                                          } else {
                                            setTagInputs((prev) => ({
                                              ...prev,
                                              [tableName]: val,
                                            }));
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (
                                            (e.key === "Enter" || e.key === ",") &&
                                            (tagInputs[tableName]?.trim() || "") !== ""
                                          ) {
                                            e.preventDefault();
                                            const newTag = tagInputs[tableName].trim();
                                            if (
                                              newTag.length > 0 &&
                                              !(metadata[tableName]?.tags || []).includes(newTag)
                                            ) {
                                              setMetadata((prev) => ({
                                                ...prev,
                                                [tableName]: {
                                                  ...prev[tableName],
                                                  tags: [
                                                    ...(prev[tableName]?.tags || []),
                                                    newTag,
                                                  ],
                                                },
                                              }));
                                            }
                                            setTagInputs((prev) => ({
                                              ...prev,
                                              [tableName]: "",
                                            }));
                                          } else if (
                                            e.key === "Backspace" &&
                                            (tagInputs[tableName] ?? "") === "" &&
                                            (metadata[tableName]?.tags?.length ?? 0) > 0
                                          ) {
                                            // Remove last tag if input is empty
                                            setMetadata((prev) => ({
                                              ...prev,
                                              [tableName]: {
                                                ...prev[tableName],
                                                tags: prev[tableName].tags.slice(
                                                  0,
                                                  prev[tableName].tags.length - 1
                                                ),
                                              },
                                            }));
                                          }
                                        }}
                                        placeholder="Add tag and press Enter"
                                        autoComplete="off"
                                      />
                                    </div>
                                    {/* Tag fade/slide animation */}
                                    <style>
                                      {`
                                        @keyframes fadein {
                                          from { opacity: 0; transform: translateY(10px);}
                                          to { opacity: 1; transform: translateY(0);}
                                        }
                                      `}
                                    </style>
                                  </div>
                                </div>
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => saveMetadata(tableName)}
                                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-md shadow transition font-semibold"
                                  >
                                    Save Metadata
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {cols.map((col) => {
                          const rule = rules.find((r) => r.columnName === col.name);
                          return (
                            <tr key={col.name} className="hover:bg-gray-800/50 transition-all duration-200 ease-in-out">
                              <td className="px-10 py-4 w-[30%] text-gray-200 font-medium">
                                {col.name}
                              </td>
                              <td className="px-10 py-4 w-[20%] text-gray-200">
                                {rule?.ruleType || "EXPOSE"}
                              </td>
                              <td className="px-10 py-4 w-[20%] text-gray-300 italic truncate">
                                <input
                                  type="text"
                                  className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  value={rule?.replacementText ?? ""}
                                  onChange={(e) => {
                                    // Local edit, but we save on blur
                                    setRules((prev) =>
                                      prev.map((r) =>
                                        r.columnName === col.name
                                          ? { ...r, replacementText: e.target.value }
                                          : r
                                      )
                                    );
                                  }}
                                  onBlur={async (e) => {
                                    await updateRule(col, { replacementText: e.target.value });
                                  }}
                                  placeholder="Replacement text"
                                  disabled={!rule}
                                />
                              </td>
                              <td className="px-10 py-4 w-[15%] text-gray-300 truncate">
                                <select
                                  className="bg-[#25262c] text-gray-200 px-2 py-1 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  value={rule?.role ?? ""}
                                  onChange={async (e) => {
                                    await updateRule(col, { role: e.target.value });
                                  }}
                                  disabled={true}
                                >
                                  <option value="">(none)</option>
                                  <option value="admin">admin</option>
                                  <option value="viewer">viewer</option>
                                </select>
                              </td>
                              <td className="px-10 py-4 w-[15%]">
                                <select
                                  aria-label={`Select rule for column ${col.name}`}
                                  className="bg-[#25262c] text-gray-200 px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                  value={rule?.ruleType || "EXPOSE"}
                                  onChange={async (e) => {
                                    await handleRuleChange(col, e.target.value as Rule["ruleType"]);
                                  }}
                                >
                                  <option value="EXPOSE">Expose</option>
                                  <option value="REDACT">Redact</option>
                                  <option value="MASK_EMAIL">Mask Email</option>
                                  <option value="HASH">Hash</option>
                                  <option value="REMOVE">Remove</option>
                                </select>
                              </td>
                              <td className="w-[15%]"></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </React.Fragment>
                  );
                })}
              </table>
            </div>
          </>
        )}
      </div>
      </div>
    </>
  );
}