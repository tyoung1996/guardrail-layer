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
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = input;
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setInput("");

    try {
      const res = await axios.post(
        `${API_URL}/chat`,
        {
          question: userMsg,
          connectionId: selectedConn,
        }
      );
      const data = res.data;
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

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] p-4">
      <div className="w-full max-w-4xl flex flex-col h-[80vh] relative">
        {/* Decorative gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -z-10 animate-pulse-slow"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 animate-pulse-slow" style={{ animationDelay: "1s" }}></div>

        {/* Main chat container */}
        <div className="flex-1 flex flex-col bg-[#1a1b1f]/40 backdrop-blur-xl rounded-3xl border border-gray-800/50 shadow-2xl overflow-hidden">
          {/* Connection selector - Always visible */}
          <div className="border-b border-gray-800/50 bg-[#13141a]/60 backdrop-blur-sm px-6 py-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-400">Database:</label>
              <div className="relative flex-1 max-w-xs">
                <select
                  value={selectedConn}
                  onChange={(e) => setSelectedConn(e.target.value)}
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
          <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
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