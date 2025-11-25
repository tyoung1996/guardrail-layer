import React, { useState, useEffect } from "react";
import axios from "../lib/axios";
import { PaperAirplaneIcon, SparklesIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

const API_URL = import.meta.env.VITE_API_URL;

function renderStars(rating: number) {
  const stars = [];
  const roundedRating = Math.round(rating * 2) / 2;
  for (let i = 1; i <= 5; i++) {
    if (i <= roundedRating) {
      stars.push(<span key={i} style={{ color: "#facc15" }}>★</span>);
    } else if (i - 0.5 === roundedRating) {
      stars.push(<span key={i} style={{ color: "#facc15" }}>★</span>);
    } else {
      stars.push(<span key={i} style={{ color: "#555" }}>☆</span>);
    }
  }
  return <span style={{ whiteSpace: "nowrap" }}>{stars}</span>;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "👋 Hello! Ask me anything about your data." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);

  // For scrolling to latest message
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  async function fetchSessions() {
    const res = await axios.get(`${API_URL}/chat/sessions`);
    setSessions(res.data);
  }

  async function loadSession(id: string) {
    setSessionId(id);
    const res = await axios.get(`${API_URL}/chat/${id}/messages`);
    setMessages(res.data.map((m: any) => ({ role: m.role, content: m.content })));
    // Fetch session title (optional, but we have it in sessions list)
    // Could update sessions state if needed, but currently sessions have titles from fetchSessions
  }

  async function startNewSession() {
    // POST to create new session with default title "New Chat"
    try {
      const res = await axios.post(`${API_URL}/chat/session`, { title: "New Chat" });
      const newSession = res.data;
      await fetchSessions();
      if (newSession.id) {
        setSessionId(newSession.id);
        setMessages([{ role: "assistant", content: "👋 New chat started!" }]);
      }
    } catch (err) {
      console.error("Failed to start new session:", err);
    }
  }

  async function renameSession(id: string, title: string) {
    try {
      await axios.patch(`${API_URL}/chat/session/${id}`, { title });
      setRenamingId(null);
      setRenameValue("");
      await fetchSessions();
    } catch (err) {
      console.error("Failed to rename session:", err);
    }
  }

  async function deleteSession(id: string) {
    try {
      await axios.delete(`${API_URL}/chat/session/${id}`);
      setDeletingId(null);
      if (sessionId === id) {
        setSessionId(null);
        setMessages([{ role: "assistant", content: "👋 Hello! Ask me anything about your data." }]);
      }
      await fetchSessions();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  }

  useEffect(() => {
    async function fetchConnections() {
      try {
        const res = await axios.get(`${API_URL}/connections`);
        setConnections(res.data);
      } catch (err) {
        console.error("Failed to fetch connections:", err);
      }
    }
    fetchConnections();
    fetchSessions();
    const lastConn = localStorage.getItem("last-connection-id");
    if (lastConn) setSelectedConn(lastConn);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      const payload: any = {
        question: userMsg,
        connectionId: selectedConn,
      };
      if (sessionId) {
        payload.sessionId = sessionId;
      }

      const res = await axios.post(`${API_URL}/chat`, payload);
      const data = res.data;

      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        fetchSessions();
      }

      if (data.summary) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.summary }]);
      } else if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ No response." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  }

  // Auto load first session if exists and no active session
  useEffect(() => {
    if (sessions.length > 0 && !sessionId) {
      const first = sessions[0];
      setSessionId(first.id);
      loadSession(first.id);
    }
  }, [sessions]);

  return (
    <div className="flex w-full h-[80vh] min-h-0">
      {/* Sidebar */}
      <div className="w-64 h-full bg-[#141519]/70 border-r border-gray-800/40 backdrop-blur-xl hidden md:flex flex-col">
        <div className="p-4 border-b border-gray-800/40">
          <button
            onClick={startNewSession}
            className="w-full px-4 py-2 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white font-medium shadow hover:scale-105 transition-all"
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((s) => (
            <div key={s.id} className="relative group">
              <div
                onClick={() => {
                  if (!renamingId && !deletingId) loadSession(s.id);
                }}
                className={`cursor-pointer px-3 py-2 rounded-lg text-sm select-none ${
                  sessionId === s.id
                    ? "bg-purple-600/20 text-purple-300"
                    : "bg-[#1a1b1f]/40 text-gray-300 hover:bg-[#272830]"
                } flex items-center justify-between`}
              >
                {renamingId === s.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded px-2 py-1 text-sm bg-[#0f1014]/80 border border-gray-700/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          renameSession(s.id, renameValue.trim() || "Untitled chat");
                        }
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setRenameValue("");
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        renameSession(s.id, renameValue.trim() || "Untitled chat");
                      }}
                      className="px-2 py-1 rounded bg-purple-600 text-white text-xs hover:bg-purple-700 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(null);
                        setRenameValue("");
                      }}
                      className="px-2 py-1 rounded bg-gray-700 text-white text-xs hover:bg-gray-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : deletingId === s.id ? (
                  <div className="flex-1 flex items-center gap-2 text-sm text-amber-400">
                    <span>Are you sure?</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      Yes
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingId(null);
                      }}
                      className="px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-800 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span className="flex-1 truncate">{s.title || "Untitled chat"}</span>
                )}
                {renamingId !== s.id && deletingId !== s.id && (
                  <div
                    className="relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpenId(dropdownOpenId === s.id ? null : s.id);
                    }}
                  >
                    <button
                      aria-label="Options"
                      className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v.01M12 12v.01M12 18v.01" />
                      </svg>
                    </button>
                    {dropdownOpenId === s.id && (
                      <div
                        className="absolute right-0 top-full mt-1 w-24 bg-[#1a1b1f]/90 border border-gray-700 rounded shadow-lg z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setRenamingId(s.id);
                            setRenameValue(s.title || "");
                            setDropdownOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1 text-sm hover:bg-purple-600 hover:text-white transition"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setDeletingId(s.id);
                            setDropdownOpenId(null);
                          }}
                          className="w-full text-left px-3 py-1 text-sm hover:bg-red-600 hover:text-white transition"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 animate-pulse-slow" style={{ animationDelay: "1s" }}></div>

        {/* Main chat container */}
        <div className="flex-1 flex flex-col h-full min-h-0 bg-[#1a1b1f]/40 backdrop-blur-xl rounded-3xl border border-gray-800/50 shadow-2xl overflow-hidden">
          {/* Connection selector - Always visible */}
          <div className="border-b border-gray-800/50 bg-[#13141a]/60 backdrop-blur-sm px-6 py-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-400">Database:</label>
              <div className="relative flex-1 max-w-xs">
                <select
                  value={selectedConn}
                  onChange={(e) => {
                    setSelectedConn(e.target.value);
                    localStorage.setItem("last-connection-id", e.target.value);
                  }}
                  className="w-full appearance-none rounded-xl px-4 py-2.5 pr-10 text-sm bg-[#0f1014]/80 border border-gray-700/50 text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all cursor-pointer hover:border-gray-600"
                >
                  <option value="">Select a connection</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {conn.name || conn.id}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Demo mode banner */}
          {import.meta.env.VITE_DEMO_MODE === "true" && (
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 animate-shimmer"></div>
              <div className="relative flex items-center justify-center gap-2.5 px-4 py-3 border-b border-gray-800/50">
                <div className="relative">
                  <div className="w-2 h-2 bg-amber-400 rounded-full animate-ping absolute"></div>
                  <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                </div>
                <span className="text-sm font-medium text-amber-200/90">
                  Demo Mode Active
                </span>
                <span className="text-sm text-amber-300/60">•</span>
                <span className="text-sm text-amber-200/70">
                  Running on sample data
                </span>
              </div>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 min-h-0 max-h-full overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fadeIn`}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0 mt-1">
                      <SparklesIcon className="w-4 h-4 text-white" />
                    </div>
                    <div
                      className="max-w-[80%] px-5 py-4 rounded-2xl rounded-tl-sm bg-[#1a1b1f]/80 backdrop-blur-sm border border-gray-800/50 text-gray-200 leading-relaxed shadow-lg"
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                  </div>
                )}
                
                {msg.role === "user" && (
                  <div className="flex items-start gap-3">
                    <div
                      className="max-w-[80%] px-5 py-4 rounded-2xl rounded-tr-sm bg-gradient-to-br from-purple-600 to-indigo-600 text-white leading-relaxed shadow-xl"
                      dangerouslySetInnerHTML={{ __html: msg.content }}
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-gray-300 font-semibold text-xs flex-shrink-0 mt-1 border border-gray-700">
                      You
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start animate-fadeIn">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                    <SparklesIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-5 py-4 rounded-2xl rounded-tl-sm bg-[#1a1b1f]/80 backdrop-blur-sm border border-gray-800/50">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      </div>
                      <span className="text-sm text-gray-400">Thinking</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-800/50 bg-[#13141a]/60 backdrop-blur-md p-4">
            <form onSubmit={handleSend} className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  className="w-full rounded-2xl px-5 py-4 text-sm bg-[#0f1014]/80 border border-gray-700/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all shadow-inner"
                  placeholder="Ask a question about your data..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !selectedConn}
                className="rounded-2xl px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-purple-900/30 transition-all hover:shadow-xl hover:shadow-purple-900/40 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.4s ease-out;
          }
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
          .animate-pulse-slow {
            animation: pulse-slow 8s ease-in-out infinite;
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .animate-shimmer {
            animation: shimmer 3s infinite;
          }
          .scrollbar-thin::-webkit-scrollbar {
            width: 6px;
          }
          .scrollbar-thumb-gray-700::-webkit-scrollbar-thumb {
            background-color: rgb(55, 65, 81);
            border-radius: 3px;
          }
          .scrollbar-thumb-gray-700::-webkit-scrollbar-thumb:hover {
            background-color: rgb(75, 85, 99);
          }
          .scrollbar-track-transparent::-webkit-scrollbar-track {
            background: transparent;
          }
        `}
      </style>
    </div>
  );
}
