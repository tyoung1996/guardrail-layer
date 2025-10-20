import React, { useState, useEffect } from "react";
import axios from "axios";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

const API_URL = import.meta.env.VITE_API_URL;

function renderStars(rating: number) {
  const stars = [];
  const roundedRating = Math.round(rating * 2) / 2; // round to nearest 0.5
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
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userMsg,
          connectionId: selectedConn,
        }),
      });
      const data = await res.json();
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0f1115] via-[#151821] to-[#0e1014] text-gray-100">
      {/* Top bar to match app theme */}
      <header className="sticky top-0 z-20 w-full backdrop-blur-lg bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-blue-900/30 border-b border-white/10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_12px_2px_rgba(99,102,241,0.6)]" />
            <h1 className="text-2xl font-semibold tracking-tight text-white select-none">Guardrail Layer</h1>
          </div>
          <span className="text-sm text-gray-400 select-none">AI Chat (metadata-aware)</span>
        </div>
      </header>

      {/* Chat container */}
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="rounded-3xl border border-white/20 bg-white/5 backdrop-blur-2xl shadow-2xl flex flex-col h-[75vh]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => {
                if (msg.role === "assistant") {
                  // Generic markdown-style renderer (bold, italics, emojis)
                  let formatted = msg.content
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/(\$[\d,]+\.\d{2})/g, '<strong>$1</strong>');

                  // Preserve existing rating/star logic but make it compatible
                  const ratingRegex = /average rating\s*(?:of|:)\s*\**(\d+(?:\.\d+)?)\**/i;
                  const match = msg.content.match(ratingRegex);
                  if (match) {
                    const ratingNum = parseFloat(match[1]);
                    const parts = msg.content.split(ratingRegex);
                    return (
                      <div key={idx} className="flex justify-start transition-all">
                        <div className="max-w-[78%] px-4 py-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed bg-[#10131a]/80 border border-white/10 text-gray-100">
                          {parts[0]}
                          <span style={{ whiteSpace: 'nowrap' }}>{renderStars(ratingNum)} <strong>({ratingNum.toFixed(2)})</strong></span>
                          {parts.slice(2).join('')}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="flex justify-start transition-all">
                      <div className="max-w-[78%] px-4 py-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed bg-[#10131a]/80 border border-white/10 text-gray-100">
                        <div dangerouslySetInnerHTML={{ __html: formatted }} />
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} transition-all`}
                  >
                    <div
                      className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
                          : "bg-[#10131a]/80 border border-white/10 text-gray-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              {loading && <div className="text-gray-400 text-sm italic">Thinking…</div>}
            </div>

            <div className="px-6 py-2 border-b border-white/10 bg-white/5">
              <label className="text-sm text-gray-400 mr-2">Database Connection:</label>
              <select
                value={selectedConn}
                onChange={(e) => setSelectedConn(e.target.value)}
                className="bg-[#0f1115] border border-white/20 rounded-xl px-3 py-2 text-gray-100 focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="">Select connection...</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.name || conn.connectionUrl}
                  </option>
                ))}
              </select>
            </div>

            {/* Composer */}
            <form onSubmit={handleSend} className="border-t border-white/10 p-4 flex items-center gap-3 bg-white/5">
              <input
                type="text"
                className="flex-1 rounded-2xl px-4 py-3 text-sm bg-white/10 border border-white/20 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/40 focus:border-indigo-400 transition"
                placeholder="Ask a question about your data…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !selectedConn}
                className="rounded-2xl px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium shadow-lg shadow-indigo-900/40 transition disabled:opacity-50"
              >
                <span className="sr-only">Send</span>
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-white/10 text-center text-sm text-gray-500 backdrop-blur-md bg-white/5 select-none">
        © {new Date().getFullYear()} Guardrail Layer — Built for Secure AI Data Access
      </footer>
    </div>
  );
}