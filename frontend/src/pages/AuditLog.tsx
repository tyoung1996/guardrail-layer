import React, { useEffect, useState } from "react";
import axios from "axios";

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // No server-side filtering, fetch all and filter client-side
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/audit`);
      setLogs(res.data || []);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };



  const toggleDetails = (id: string) => {
    setExpandedDetails((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ["Action", "Details", "Connection", "User", "Created At"];
    const rows = filteredLogs.map((log: any) => [
      log.action,
      log.details,
      log.connectionId || "",
      log.userId || "",
      new Date(log.createdAt).toLocaleString(),
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) =>
          e
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tryParseJSON = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  // Fuzzy search/filter across all fields (action, details, connectionId, userId)
  function fuzzyIncludes(hay: string, needle: string) {
    if (!needle) return true;
    return hay.toLowerCase().includes(needle.toLowerCase());
  }
  // Combine all searchable fields into a string and check
  const filteredLogs = logs.filter((log: any) => {
    const combined = [
      log.action,
      log.details,
      log.connectionId || "",
      log.userId || ""
    ].join(" ").toLowerCase();
    return fuzzyIncludes(combined, search);
  });

  // Redaction badge color by rule type
  const badgeColor = (rule: string) => {
    switch (rule) {
      case "REDACT":
        return "bg-red-800/80 border-red-600 text-red-200";
      case "MASK_EMAIL":
        return "bg-yellow-800/80 border-yellow-500 text-yellow-200";
      case "HASH":
        return "bg-blue-900/80 border-blue-600 text-blue-200";
      case "REMOVE":
        return "bg-pink-900/80 border-pink-600 text-pink-200";
      default:
        return "bg-gray-800/80 border-gray-600 text-gray-200";
    }
  };

  return (
    <div className="bg-gray-950 text-gray-100 max-w-6xl mx-auto p-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
        <h1 className="text-3xl font-semibold border-b border-gray-800 pb-3 mb-0 md:mb-0">Audit Logs</h1>
        <button
          onClick={exportCSV}
          disabled={loading || filteredLogs.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-5 py-2 rounded-xl transition shadow font-medium text-sm"
        >
          Export CSV
        </button>
      </div>

      <div className="mb-8">
        <input
          type="text"
          placeholder="Search audit logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900/80 border border-gray-700 rounded-xl px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono text-base transition"
        />
      </div>

      {loading && (
        <div className="bg-blue-900 border border-blue-700 text-blue-300 p-4 rounded mb-6 shadow-sm">
          Loading...
        </div>
      )}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-400 p-4 rounded mb-6 shadow-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-6">
        {filteredLogs.length === 0 && !loading && (
          <div className="text-center p-6 text-gray-500 border-t border-gray-800">
            No audit logs found.
          </div>
        )}
        {filteredLogs.map((log: any) => {
          const isExpanded = expandedDetails[log.id] || false;
          const details = log.details || "";
          const shouldTruncate = details.length > 280;
          const displayedDetails = isExpanded ? details : details.slice(0, 280);
          const parsedJSON = tryParseJSON(details);
          const hasQuestionAndSQL = parsedJSON && typeof parsedJSON === 'object' && 'question' in parsedJSON && 'sql' in parsedJSON;
          // Card
          return (
            <div
              key={log.id}
              className="rounded-xl bg-gray-900/80 border border-gray-800 shadow-lg hover:shadow-xl transition p-0 overflow-hidden"
            >
              {/* Header row */}
              <div className="flex justify-between items-center px-5 py-4 border-b border-gray-800 bg-gray-950/60">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base text-blue-300">{log.action}</span>
                  {log.connectionId && (
                    <span className="ml-3 text-xs text-gray-400 bg-gray-800/70 rounded px-2 py-0.5 font-mono">{log.connectionId}</span>
                  )}
                  {log.userId && (
                    <span className="ml-2 text-xs text-gray-400 bg-gray-800/70 rounded px-2 py-0.5 font-mono">{log.userId}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
              {/* Body */}
              <div className="px-5 py-4">
                {/* Details Section */}
                {parsedJSON ? (
                  <>
                    {hasQuestionAndSQL ? (
                      <div>
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 text-xs text-gray-400 uppercase select-none">
                              <span role="img" aria-label="question" className="text-lg">💬</span>
                              <span>Question</span>
                            </div>
                            <div className="rounded-xl bg-gray-800/70 p-3 text-sm text-gray-100 whitespace-pre-wrap mb-3 font-mono shadow-inner">{parsedJSON.question}</div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 text-xs text-gray-400 uppercase select-none">
                              <span role="img" aria-label="sql" className="text-lg">🧾</span>
                              <span>SQL</span>
                            </div>
                            <pre className="rounded-xl bg-gray-900/90 text-xs text-green-300 font-mono p-3 mb-3 shadow-inner overflow-x-auto max-w-full"
                              style={{ lineHeight: "1.6", fontSize: "0.85rem" }}
                            >{parsedJSON.sql}</pre>
                          </div>
                        </div>
                        {/* Show More/Less for details if long */}
                        {details.length > 600 && (
                          <button
                            onClick={() => toggleDetails(log.id)}
                            className="text-blue-400 hover:underline mt-2 flex items-center gap-1 select-none text-xs"
                            type="button"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <>
                                <span>Show less</span> <span aria-hidden="true">▼</span>
                              </>
                            ) : (
                              <>
                                <span>Show more</span> <span aria-hidden="true">▶</span>
                              </>
                            )}
                          </button>
                        )}
                        {/* Redaction Summary */}
                        {parsedJSON.redactionImpact && typeof parsedJSON.redactionImpact === "object" && (
                          <div className="mt-5 bg-gray-950/70 rounded-xl p-4 border border-gray-800">
                            <div className="text-xs text-gray-400 uppercase mb-2 font-semibold tracking-wider">Redaction Summary</div>
                            {(() => {
                              const redactionImpact = parsedJSON.redactionImpact;
                              const ruleSummary = redactionImpact.ruleSummary && typeof redactionImpact.ruleSummary === "object" ? redactionImpact.ruleSummary : {};
                              const keys = ["REDACT", "MASK_EMAIL", "HASH", "REMOVE"];
                              return (
                                <>
                                  <div className="mb-2 flex flex-wrap gap-2">
                                    {keys.map((k) => (
                                      <span
                                        key={k}
                                        className={`inline-block font-semibold text-xs rounded px-2 py-0.5 border ${badgeColor(k)}`}
                                      >
                                        {k}: {ruleSummary[k] ?? 0}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-4 mt-2">
                                    {Array.isArray(redactionImpact.hiddenColumns) && redactionImpact.hiddenColumns.length > 0 && (
                                      <div>
                                        <div className="text-xs text-gray-400 font-semibold mb-1">Hidden Columns</div>
                                        <div className="flex flex-wrap gap-1">
                                          {redactionImpact.hiddenColumns.map((col: string, i: number) => (
                                            <span key={col + i} className="inline-block bg-gray-800/80 text-gray-300 text-xs rounded px-2 py-0.5 border border-gray-700">{col}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {Array.isArray(redactionImpact.maskedColumns) && redactionImpact.maskedColumns.length > 0 && (
                                      <div>
                                        <div className="text-xs text-gray-400 font-semibold mb-1">Masked Columns</div>
                                        <div className="flex flex-wrap gap-1">
                                          {redactionImpact.maskedColumns.map((col: string, i: number) => (
                                            <span key={col + i} className="inline-block bg-gray-800/80 text-gray-300 text-xs rounded px-2 py-0.5 border border-gray-700">{col}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {Array.isArray(redactionImpact.hashApplied) && redactionImpact.hashApplied.length > 0 && (
                                      <div>
                                        <div className="text-xs text-gray-400 font-semibold mb-1">Hash Applied</div>
                                        <div className="flex flex-wrap gap-1">
                                          {redactionImpact.hashApplied.map((col: string, i: number) => (
                                            <span key={col + i} className="inline-block bg-gray-800/80 text-gray-300 text-xs rounded px-2 py-0.5 border border-gray-700">{col}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {Array.isArray(redactionImpact.removedFromSchema) && redactionImpact.removedFromSchema.length > 0 && (
                                      <div>
                                        <div className="text-xs text-gray-400 font-semibold mb-1">Removed From Schema</div>
                                        <div className="flex flex-wrap gap-1">
                                          {redactionImpact.removedFromSchema.map((col: string, i: number) => (
                                            <span key={col + i} className="inline-block bg-gray-800/80 text-gray-300 text-xs rounded px-2 py-0.5 border border-gray-700">{col}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <details className="bg-gray-950/60 text-gray-300 text-xs rounded p-2 mt-3">
                                    <summary className="cursor-pointer select-none">Show full redaction impact</summary>
                                    <pre className="whitespace-pre-wrap mt-2 font-mono">{JSON.stringify(redactionImpact, null, 2)}</pre>
                                  </details>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <pre
                          className={`bg-gray-950/60 text-gray-300 text-xs rounded-xl p-3 overflow-x-auto font-mono transition-all duration-200 ease-in-out ${
                            isExpanded ? "max-h-[600px]" : "max-h-[7rem] overflow-hidden"
                          }`}
                        >
                          {JSON.stringify(parsedJSON, null, 2)}
                        </pre>
                        {details.length > 200 && (
                          <button
                            onClick={() => toggleDetails(log.id)}
                            className="text-blue-400 hover:underline mt-2 flex items-center gap-1 select-none text-xs"
                            type="button"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? (
                              <>
                                <span>Show less</span> <span aria-hidden="true">▼</span>
                              </>
                            ) : (
                              <>
                                <span>Show more</span> <span aria-hidden="true">▶</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div>
                    <div className="text-sm text-gray-200 font-mono break-words">
                      {displayedDetails}
                      {shouldTruncate && (
                        <>
                          {!isExpanded && "... "}
                          <button
                            onClick={() => toggleDetails(log.id)}
                            className="text-blue-400 hover:underline ml-1 text-xs"
                            type="button"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}