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
            <div className="flex justify-end mb-6">
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
                                {rule?.replacementText || "-"}
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
  );
}