// src/components/Chatbot.jsx
import { useState } from "react";

export default function Chatbot({ agentName, env }) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleConnect(e) {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;
    setApiKey(apiKeyInput.trim());
    setConnected(true);
    setErrorMsg("");
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim()) return;
    if (!apiKey) {
      setErrorMsg("Please connect your OpenAI API key first.");
      return;
    }

    const userMessage = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, { ...userMessage, side: "user" }]);
    setInput("");
    setLoading(true);
    setErrorMsg("");

    try {
      const resp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a trading assistant for a Recall competition agent. The agent name is "${agentName ||
                  "Unknown"}" and current environment is "${env ||
                  "sandbox"}". Answer briefly and clearly.`,
              },
              ...messages.map((m) => ({
                role: m.side === "user" ? "user" : "assistant",
                content: m.content,
              })),
              userMessage,
            ],
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || resp.statusText);
      }

      const data = await resp.json();
      const reply =
        data.choices?.[0]?.message?.content?.trim() ||
        "I couldn't generate a response. Please try again.";

      setMessages((prev) => [
        ...prev,
        { ...userMessage, side: "user" },
        { role: "assistant", content: reply, side: "assistant" },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          side: "assistant",
          content: "I couldn't generate a response. Please try again.",
        },
      ]);
      setErrorMsg("Request to OpenAI failed. Check your API key & balance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">
            Chatbot
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Ask anything about your agent&apos;s performance, balances, or
            strategy ideas.
          </p>
        </div>

        <form
          onSubmit={handleConnect}
          className="flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-1.5"
        >
          <input
            type="password"
            placeholder="OpenAI API key (sk-...)"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            className="w-48 bg-transparent text-xs text-neutral-200 placeholder:text-neutral-600 outline-none"
          />
          <button
            type="submit"
            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              connected
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/40"
                : "bg-sky-500 text-black border border-sky-500"
            }`}
          >
            {connected ? "Connected" : "Connect"}
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Chat area */}
      <div className="flex min-h-[280px] flex-col rounded-2xl bg-neutral-950/80 p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-xs text-neutral-600">
              Start by asking something like{" "}
              <span className="text-neutral-300">
                &quot;How is my agent performing?&quot;
              </span>
            </p>
          )}

          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex ${
                m.side === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  m.side === "user"
                    ? "bg-sky-500 text-black"
                    : "bg-neutral-800 text-neutral-100"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="mt-4 flex items-center gap-2 rounded-xl bg-neutral-900/80 px-3 py-2"
        >
          <input
            type="text"
            placeholder="Ask something about your agent..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder:text-neutral-600 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
