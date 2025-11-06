import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import {
  Shield,
  Eye,
  EyeOff,
  Hash,
  Mail,
  Trash2,
  Plus,
  Save,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  X
} from "lucide-react";
const DEMO_MODE = import.meta.env.SHOW_DEMO_DB === "true";
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
  tags: string[];
}

type GlobalRule = {
  id?: string;
  name: string;
  pattern: string;
  replacement: string;
  role?: string;
};

export default function Redactions() {
  const { connectionId } = useParams();
  const [rules, setRules] = useState<Rule[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({});
  const [showRemovedTables, setShowRemovedTables] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, Metadata>>({});
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Global modal state
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalRules, setGlobalRules] = useState<GlobalRule[]>([]);
  const [globalModalLoading, setGlobalModalLoading] = useState(false);
  const [globalModalError, setGlobalModalError] = useState<string | null>(null);
  const [newGlobalRule, setNewGlobalRule] = useState<GlobalRule>({ name: "", pattern: "", replacement: "", role: "" });
  const [deletedGlobalRuleIds, setDeletedGlobalRuleIds] = useState<string[]>([]);
  
  // Regex builder state
  const [regexTestInput, setRegexTestInput] = useState("");
  const [regexTestOutput, setRegexTestOutput] = useState("");
  const [showRegexBuilder, setShowRegexBuilder] = useState(false);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const toggleTable = (table: string) => {
    setCollapsedTables((prev) => {
      const newCollapsed = { ...prev, [table]: !prev[table] };
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
      setTagInputs((prev) => ({ ...prev, [tableName]: "" }));
    } catch {
      setMetadata((prev) => ({
        ...prev,
        [tableName]: { description: "", notes: "", tags: [] },
      }));
      setTagInputs((prev) => ({ ...prev, [tableName]: "" }));
    }
  };

  const saveMetadata = async (tableName: string) => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    try {
      const meta = metadata[tableName];
      await axios.post(`${API_URL}/metadata/${connectionId}/${tableName}`, {
        description: meta.description,
        notes: meta.notes,
        tags: (meta.tags || []).join(","),
      });
      showSuccess("Metadata saved successfully");
    } catch {
      setError("Failed to save metadata");
    }
  };

  const handleRuleChange = async (col: Column, newRuleType: Rule["ruleType"]) => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    try {
      await axios.post(`${API_URL}/redactions`, {
        connectionId,
        tableName: col.table,
        columnName: col.name,
        ruleType: newRuleType,
      });
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
      showSuccess(`Rule updated for ${col.name}`);
    } catch {
      setError("Failed to update rule");
    }
  };

  const updateRule = async (col: Column, updatedFields: Partial<Pick<Rule, "replacementText" | "role">>) => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    try {
      await axios.post(`${API_URL}/redactions/update`, {
        connectionId,
        tableName: col.table,
        columnName: col.name,
        ...updatedFields,
      });
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
    } catch {
      setError("Failed to update rule");
    }
  };

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
    setShowGlobalModal(true);
    fetchGlobalRules();
    setNewGlobalRule({ name: "", pattern: "", replacement: "", role: "" });
    setGlobalModalError(null);
  };

  const handleAddGlobalRule = () => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    if (!newGlobalRule.name.trim() || !newGlobalRule.pattern.trim()) return;
    setGlobalRules((prev) => [...prev, { ...newGlobalRule }]);
    setNewGlobalRule({ name: "", pattern: "", replacement: "", role: "" });
  };

  const handleDeleteGlobalRule = (idx: number) => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
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
      prev.map((rule, i) => (i === idx ? { ...rule, [field]: value } : rule))
    );
  };

  const handleSaveGlobalRules = async () => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    setGlobalModalLoading(true);
    setGlobalModalError(null);
    try {
      for (const id of deletedGlobalRuleIds) {
        try {
          await axios.delete(`${API_URL}/redactions/global/${id}`);
        } catch (err) {
          console.warn("Failed to delete rule", id, err);
        }
      }
      setDeletedGlobalRuleIds([]);

      for (const rule of globalRules) {
        const payload = {
          name: rule.name?.trim() ?? "",
          pattern: rule.pattern?.trim() ?? "",
          replacement: rule.replacement ?? "",
          role: rule.role ?? "",
        };
        if (!payload.name || !payload.pattern) continue;
        await axios.post(`${API_URL}/redactions/global`, payload);
      }

      setShowGlobalModal(false);
      await fetchGlobalRules();
      showSuccess("Global rules saved successfully");
    } catch (e) {
      setGlobalModalError("Failed to save global regex rules.");
    } finally {
      setGlobalModalLoading(false);
    }
  };

  const handleTableRuleChange = async (tableName: string, newRuleType: Rule["ruleType"]) => {
    if (DEMO_MODE) {
      showSuccess("Demo mode — changes aren’t saved.");
      return;
    }
    try {
      await axios.post(`${API_URL}/redactions/table`, {
        connectionId,
        tableName,
        ruleType: newRuleType,
      });
      const rulesRes = await axios.get(`${API_URL}/redactions/${connectionId}`);
      setRules(rulesRes.data);
      showSuccess(`Applied ${newRuleType} to all columns in ${tableName}`);
    } catch {
      setError("Failed to update table rule");
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

  const filteredTables = Object.entries(groupedColumns).filter(([tableName, cols]) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return tableName.toLowerCase().includes(query) || 
           cols.some(col => col.name.toLowerCase().includes(query));
  });

  const getRuleIcon = (ruleType?: string) => {
    switch(ruleType) {
      case "REDACT": return <Shield className="w-4 h-4" />;
      case "MASK_EMAIL": return <Mail className="w-4 h-4" />;
      case "HASH": return <Hash className="w-4 h-4" />;
      case "REMOVE": return <EyeOff className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getRuleBadgeColor = (ruleType?: string) => {
    switch(ruleType) {
      case "REDACT": return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "MASK_EMAIL": return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "HASH": return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "REMOVE": return "bg-red-500/20 text-red-300 border-red-500/40";
      default: return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {DEMO_MODE && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-center py-3 font-medium">
          Demo Mode — edits will not be saved.
        </div>
      )}
      {/* Success Toast */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 backdrop-blur-xl">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 backdrop-blur-xl">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
            <button onClick={() => setError(null)} className="ml-4 hover:text-red-200 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Global Regex Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-violet-500/10 to-purple-500/10">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  <Shield className="w-7 h-7 text-violet-400" />
                  Global Regex Rules
                </h2>
                <p className="text-sm text-slate-400 mt-1">Apply pattern-based redactions across all tables</p>
              </div>
              <button
                onClick={() => setShowGlobalModal(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl p-2.5 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {globalModalError && (
                <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 px-5 py-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>{globalModalError}</span>
                </div>
              )}

              {globalModalLoading ? (
                <div className="text-center py-16">
                  <div className="inline-block w-10 h-10 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin"></div>
                  <p className="text-slate-400 mt-4 font-medium">Loading rules...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Regex Pattern Quick Actions */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-slate-300">Quick Patterns</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
                        { label: "SSN", pattern: "\\b\\d{3}[-.]?\\d{2}[-.]?\\d{4}\\b" },
                        { label: "Credit Card", pattern: "\\b(?:\\d[ -]*?){13,16}\\b" },
                        { label: "Phone", pattern: "\\b\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b" },
                        { label: "IP Address", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
                      ].map(({ label, pattern }) => (
                        <button
                          key={label}
                          onClick={() => setNewGlobalRule(r => ({ ...r, pattern }))}
                          className="bg-slate-700/50 hover:bg-violet-600/30 border border-slate-600/50 hover:border-violet-500/50 text-slate-300 hover:text-violet-300 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowRegexBuilder(true)}
                        className="bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/40 text-violet-300 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                      >
                        Test Pattern
                      </button>
                    </div>
                  </div>

                  {/* Existing Rules */}
                  {globalRules.map((rule, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:bg-slate-800/70 hover:border-slate-600/50 transition-all group">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        <div className="lg:col-span-3">
                          <label className="text-xs font-semibold text-slate-400 mb-2 block">Name</label>
                          <input
                            type="text"
                            className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            value={rule.name}
                            onChange={e => handleEditGlobalRule(idx, "name", e.target.value)}
                            placeholder="Rule name"
                          />
                        </div>
                        <div className="lg:col-span-4">
                          <label className="text-xs font-semibold text-slate-400 mb-2 block">Pattern</label>
                          <input
                            type="text"
                            className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            value={rule.pattern}
                            onChange={e => handleEditGlobalRule(idx, "pattern", e.target.value)}
                            placeholder="Regex pattern"
                          />
                        </div>
                        <div className="lg:col-span-3">
                          <label className="text-xs font-semibold text-slate-400 mb-2 block">Replacement</label>
                          <input
                            type="text"
                            className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                            value={rule.replacement}
                            onChange={e => handleEditGlobalRule(idx, "replacement", e.target.value)}
                            placeholder="[REDACTED]"
                          />
                        </div>
                        <div className="lg:col-span-1 flex items-end">
                          <button
                            onClick={() => handleDeleteGlobalRule(idx)}
                            className="w-full lg:w-auto bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 px-4 py-2.5 rounded-lg transition-all opacity-50 group-hover:opacity-100"
                            aria-label="Delete rule"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Add New Rule Form */}
                  <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-2 border-dashed border-violet-500/30 rounded-xl p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                      <div className="lg:col-span-3">
                        <label className="text-xs font-semibold text-slate-400 mb-2 block">Name</label>
                        <input
                          type="text"
                          className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          value={newGlobalRule.name}
                          onChange={e => setNewGlobalRule(r => ({ ...r, name: e.target.value }))}
                          placeholder="Rule name"
                        />
                      </div>
                      <div className="lg:col-span-4">
                        <label className="text-xs font-semibold text-slate-400 mb-2 block">Pattern</label>
                        <input
                          type="text"
                          className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          value={newGlobalRule.pattern}
                          onChange={e => setNewGlobalRule(r => ({ ...r, pattern: e.target.value }))}
                          placeholder="Regex pattern"
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <label className="text-xs font-semibold text-slate-400 mb-2 block">Replacement</label>
                        <input
                          type="text"
                          className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                          value={newGlobalRule.replacement}
                          onChange={e => setNewGlobalRule(r => ({ ...r, replacement: e.target.value }))}
                          placeholder="[REDACTED]"
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <button
                          onClick={handleAddGlobalRule}
                          disabled={!newGlobalRule.name.trim() || !newGlobalRule.pattern.trim()}
                          className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-700/50 bg-slate-900/50">
              <button
                onClick={() => setShowGlobalModal(false)}
                disabled={globalModalLoading}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGlobalRules}
                disabled={globalModalLoading}
                className="px-8 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:bg-slate-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                {globalModalLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Rules
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regex Builder Modal */}
      {showRegexBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                  Pattern Tester
                </h2>
                <p className="text-sm text-slate-400 mt-1">Test your regex patterns in real-time</p>
              </div>
              <button
                onClick={() => setShowRegexBuilder(false)}
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl p-2.5 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Pattern</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  value={newGlobalRule.pattern}
                  onChange={e => setNewGlobalRule(r => ({ ...r, pattern: e.target.value }))}
                  placeholder="Enter regex pattern"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Test Input</label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  rows={4}
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
                  placeholder="Paste sample text to test your regex pattern..."
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-300 mb-2 block">Preview</label>
                <div className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 min-h-[120px] whitespace-pre-wrap font-mono text-sm">
                  {(() => {
                    if (regexTestOutput.startsWith("⚠️")) {
                      return <span className="text-yellow-400">{regexTestOutput}</span>;
                    }
                    if (!regexTestOutput) {
                      return <span className="text-slate-500 italic">Matches will be highlighted here...</span>;
                    }
                    const parts = regexTestOutput.split(/\[\[|\]\]/);
                    let highlight = false;
                    if (regexTestOutput.startsWith('[[')) highlight = true;
                    return parts.map((part, idx) => {
                      if (idx > 0) highlight = !highlight;
                      if (highlight && part) {
                        return <span key={idx} className="bg-yellow-500/30 text-yellow-200 rounded px-1">{part}</span>;
                      }
                      return <span key={idx}>{part}</span>;
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-8 py-5 border-t border-slate-700/50 bg-slate-900/50">
              <button
                onClick={() => setShowRegexBuilder(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-violet-500/10 border border-violet-500/30 rounded-xl">
              <Shield className="w-8 h-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-100">Redaction Rules</h1>
              <p className="text-slate-400 mt-1">Manage data protection and privacy controls</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-24">
            <div className="inline-block w-12 h-12 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-medium">Loading rules and schema...</p>
          </div>
        ) : columns.length === 0 ? (
          <div className="text-center py-24 bg-slate-900/50 border border-slate-800 rounded-2xl">
            <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No columns found for this connection</p>
          </div>
        ) : (
          <>
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleOpenGlobalModal}
                  className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-violet-500/20 transition-all flex items-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  Global Regex Rules
                </button>
                <button
                  onClick={() => setShowRemovedTables(!showRemovedTables)}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2"
                >
                  <Filter className="w-5 h-5" />
                  {showRemovedTables ? "Hide Removed" : "Show Removed"}
                </button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-auto sm:min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search tables or columns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Tables */}
            <div className="space-y-4">
              {filteredTables.map(([tableName, cols]) => {
                const allRemoved = cols.every(
                  (col) => rules.find((r) => r.columnName === col.name && r.ruleType === "REMOVE")
                );
                if (allRemoved && !showRemovedTables) return null;
                const isCollapsed = collapsedTables[tableName];

                return (
                  <div key={tableName} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    {/* Table Header */}
                    <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b border-slate-700/50 px-6 py-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleTable(tableName)}
                          className="flex items-center gap-3 hover:text-violet-400 transition-colors group"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-violet-400 transition-colors" />
                          )}
                          <h3 className="text-xl font-bold text-slate-200">{tableName}</h3>
                          <span className="text-sm text-slate-500 font-normal">
                            {cols.length} {cols.length === 1 ? 'column' : 'columns'}
                          </span>
                        </button>

                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (DEMO_MODE) return;
                            if (confirm(`Remove all columns from ${tableName}?`)) {
                              await handleTableRuleChange(tableName, "REMOVE");
                            }
                          }}
                          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2"
                          disabled={DEMO_MODE}
                          title={DEMO_MODE ? "Disabled in demo mode" : ""}
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove All
                        </button>
                      </div>
                    </div>

                    {/* Table Content */}
                    {!isCollapsed && (
                      <div className="p-6 space-y-6">
                        {/* Metadata Section */}
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 space-y-5">
                          <div>
                            <label className="text-sm font-semibold text-slate-400 mb-2 block">Description</label>
                            <textarea
                              className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
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
                              placeholder="Add a description for this table..."
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-400 mb-2 block">Notes</label>
                            <textarea
                              className="w-full bg-slate-900/70 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
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
                              placeholder="Add notes or additional context..."
                            />
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-slate-400 mb-2 block">Tags</label>
                            <div
                              className="flex flex-wrap items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-lg px-3 py-2.5 min-h-[46px] cursor-text"
                              onClick={() => document.getElementById(`${tableName}-tags-input`)?.focus()}
                            >
                              {metadata[tableName]?.tags?.map((tag, tagIdx) => (
                                <span
                                  key={`${tag}-${tagIdx}`}
                                  className="bg-violet-500/20 border border-violet-500/30 text-violet-300 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200"
                                >
                                  {tag}
                                  <button
                                    type="button"
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
                                    className="hover:text-red-400 transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                              <input
                                id={`${tableName}-tags-input`}
                                type="text"
                                className="bg-transparent text-slate-200 focus:outline-none min-w-[120px] flex-1 py-1"
                                value={tagInputs[tableName] || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val.includes(",")) {
                                    const newTags = val
                                      .split(",")
                                      .map((t) => t.trim())
                                      .filter((t) => t.length > 0);
                                    if (newTags.length > 0) {
                                      setMetadata((prev) => ({
                                        ...prev,
                                        [tableName]: {
                                          ...prev[tableName],
                                          tags: [...(prev[tableName]?.tags || []), ...newTags],
                                        },
                                      }));
                                    }
                                    setTagInputs((prev) => ({ ...prev, [tableName]: "" }));
                                  } else {
                                    setTagInputs((prev) => ({ ...prev, [tableName]: val }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if ((e.key === "Enter" || e.key === ",") && (tagInputs[tableName]?.trim() || "")) {
                                    e.preventDefault();
                                    const newTag = tagInputs[tableName].trim();
                                    if (newTag && !(metadata[tableName]?.tags || []).includes(newTag)) {
                                      setMetadata((prev) => ({
                                        ...prev,
                                        [tableName]: {
                                          ...prev[tableName],
                                          tags: [...(prev[tableName]?.tags || []), newTag],
                                        },
                                      }));
                                    }
                                    setTagInputs((prev) => ({ ...prev, [tableName]: "" }));
                                  } else if (
                                    e.key === "Backspace" &&
                                    !tagInputs[tableName] &&
                                    (metadata[tableName]?.tags?.length ?? 0) > 0
                                  ) {
                                    setMetadata((prev) => ({
                                      ...prev,
                                      [tableName]: {
                                        ...prev[tableName],
                                        tags: prev[tableName].tags.slice(0, -1),
                                      },
                                    }));
                                  }
                                }}
                                placeholder="Add tags (press Enter)"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => saveMetadata(tableName)}
                              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-lg font-semibold transition-all flex items-center gap-2"
                              disabled={DEMO_MODE}
                              title={DEMO_MODE ? "Disabled in demo mode" : ""}
                            >
                              <Save className="w-4 h-4" />
                              Save Metadata
                            </button>
                          </div>
                        </div>

                        {/* Columns Table */}
                        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                          <table className="w-full">
                            <thead className="bg-slate-800/50 border-b border-slate-700/50">
                              <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Column Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Current Rule</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Replacement Text</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Change Rule</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {cols.map((col) => {
                                const rule = rules.find((r) => r.columnName === col.name);
                                const ruleType = rule?.ruleType || "EXPOSE";

                                return (
                                  <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                      <span className="text-slate-200 font-medium">{col.name}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${getRuleBadgeColor(ruleType)}`}>
                                        {getRuleIcon(ruleType)}
                                        {ruleType}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <input
                                        type="text"
                                        className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={rule?.replacementText ?? ""}
                                        onChange={(e) => {
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
                                        placeholder="Custom replacement..."
                                        disabled={!rule}
                                      />
                                    </td>
                                    <td className="px-6 py-4">
                                      <select
                                        className="w-full bg-slate-800/50 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all cursor-pointer"
                                        value={ruleType}
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
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredTables.length === 0 && (
                <div className="text-center py-16 bg-slate-900/50 border border-slate-800 rounded-2xl">
                  <Search className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 text-lg">No tables match your search</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-4 text-violet-400 hover:text-violet-300 font-medium"
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}