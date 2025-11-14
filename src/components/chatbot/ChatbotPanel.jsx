// src/components/chatbot/ChatbotPanel.jsx
import { useState, useEffect } from "react";
import { executeTrade } from "../../api/backend";
import { showSuccess, showError } from "../../utils/toast";
import { validateTradeBalance } from "../../hooks/useTrade";

export default function ChatbotPanel({
  openaiKey,
  onSaveKey,
  balances,
  pnl,
  env,
  agentName,
  apiKey,
  onExecuteTrade,
}) {
  const [tempKey, setTempKey] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingTrade, setPendingTrade] = useState(null);

  const hasKey = !!openaiKey;

  // Load conversation history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("chatbot_history");
    if (stored) {
      try {
        const history = JSON.parse(stored);
        setMessages(history);
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
  }, []);

  // Save conversation history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatbot_history", JSON.stringify(messages));
    }
  }, [messages]);

  const contextSummary = (() => {
    const totalUsd =
      (balances || []).reduce((sum, b) => sum + (b.usd || 0), 0) || 0;
    const balancesList = (balances || [])
      .map((b) => `${b.token}: ${b.amount} ($${b.usd?.toFixed(2) || 0})`)
      .join(", ");
    return `Environment: ${env}. Agent: ${agentName || "-"}.
Total balance (approx): $${totalUsd.toFixed(2)}.
Balances: ${balancesList || "None"}.
Number of positions: ${(pnl || []).length}.`;
  })();

  async function handleExecuteTrade(tradeParams) {
    // Validate balance before executing
    const validation = validateTradeBalance(
      balances,
      tradeParams.fromToken,
      tradeParams.amount
    );

    if (!validation.valid) {
      showError(validation.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ ${validation.message}`,
        },
      ]);
      setPendingTrade(null);
      return;
    }

    try {
      setLoading(true);
      setError("");

      await executeTrade(apiKey, env, {
        fromToken: tradeParams.fromToken,
        toToken: tradeParams.toToken,
        amount: parseFloat(tradeParams.amount),
        reason: tradeParams.reason || "CHATBOT_TRADE",
      });

      showSuccess(
        `Trade executed! ${tradeParams.amount} ${tradeParams.fromToken} → ${tradeParams.toToken}`
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `✅ Trade executed successfully!\n\nFrom: ${tradeParams.amount} ${tradeParams.fromToken}\nTo: ${tradeParams.toToken}\n\nTransaction completed.`,
        },
      ]);

      if (onExecuteTrade) onExecuteTrade();
      setPendingTrade(null);
    } catch (err) {
      console.error(err);
      const errorMsg = `Trade failed: ${err.message}`;
      showError(errorMsg);
      setError(errorMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ ${errorMsg}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !openaiKey) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an assistant helping a user manage their Recall trading agent. You can execute trades when requested. Be concise and practical. When executing trades, always confirm the details clearly.",
            },
            {
              role: "system",
              content: `Context: ${contextSummary}`,
            },
            ...newMessages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "execute_trade",
                description:
                  "Execute a trade to swap tokens. Use this when the user wants to buy, sell, or swap tokens.",
                parameters: {
                  type: "object",
                  properties: {
                    fromToken: {
                      type: "string",
                      description:
                        "The token to sell/swap from (e.g., USDC, ETH, SOL)",
                    },
                    toToken: {
                      type: "string",
                      description:
                        "The token to buy/swap to (e.g., USDC, ETH, SOL)",
                    },
                    amount: {
                      type: "string",
                      description: "The amount of fromToken to trade",
                    },
                    reason: {
                      type: "string",
                      description: "Optional reason for the trade",
                    },
                  },
                  required: ["fromToken", "toToken", "amount"],
                },
              },
            },
          ],
          tool_choice: "auto",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `OpenAI API error: ${res.status}`
        );
      }

      const data = await res.json();
      const choice = data?.choices?.[0];

      // Check if AI wants to call a function
      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        if (toolCall.function.name === "execute_trade") {
          const tradeParams = JSON.parse(toolCall.function.arguments);

          // Validate balance immediately
          const validation = validateTradeBalance(
            balances,
            tradeParams.fromToken,
            tradeParams.amount
          );

          if (!validation.valid) {
            setMessages([
              ...newMessages,
              {
                role: "assistant",
                content: `❌ Cannot execute trade: ${validation.message}`,
              },
            ]);
          } else {
            // Show confirmation dialog
            setPendingTrade(tradeParams);
            setMessages([
              ...newMessages,
              {
                role: "assistant",
                content: `I want to execute this trade for you:\n\n📊 **Trade Details:**\n• Sell: ${tradeParams.amount} ${tradeParams.fromToken}\n• Buy: ${tradeParams.toToken}\n• Reason: ${tradeParams.reason || "User requested"}\n\nPlease confirm to proceed.`,
              },
            ]);
          }
        }
      } else {
        // Normal text response
        const reply =
          choice?.message?.content ||
          "I couldn't generate a response. Please try again.";
        setMessages([...newMessages, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      console.error(err);
      const errorMsg =
        "Failed to contact OpenAI. Please check your API key or try again.";
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([]);
    localStorage.removeItem("chatbot_history");
    showSuccess("Conversation history cleared");
  }

  if (!hasKey) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-800/60 bg-neutral-950/90 p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-neutral-100">
          Enable Chatbot
        </h2>
        <p className="mb-4 text-sm text-neutral-400">
          Enter your{" "}
          <span className="font-medium text-neutral-200">
            OpenAI API Key
          </span>{" "}
          to unlock AI assistance for your Recall agent.
          <br />
          Your key is stored{" "}
          <span className="font-medium">locally</span> in this browser only.
        </p>

        <input
          type="password"
          placeholder="OpenAI API Key..."
          value={tempKey}
          onChange={(e) => setTempKey(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-700/70 bg-neutral-900/70 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-purple-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-purple-500/20"
        />

        <button
          onClick={() => {
            if (!tempKey.trim()) return;
            onSaveKey(tempKey);
            setTempKey("");
          }}
          className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-sky-500 py-2.5 text-sm font-semibold text-black shadow-lg shadow-purple-500/40 transition-all hover:shadow-purple-500/60"
        >
          Save & Activate
        </button>

        <p className="mt-3 text-[11px] text-neutral-500">
          You can remove this key anytime by logging out.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[480px] max-h-[70vh] max-w-3xl flex-col rounded-2xl border border-neutral-800/60 bg-neutral-950/95 p-4 shadow-xl md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
            Chatbot
          </p>
          <p className="text-[11px] text-neutral-500">
            Ask anything about your agent&apos;s performance, balances, or
            strategy ideas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="rounded-lg bg-neutral-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 transition-all hover:bg-neutral-700 hover:text-neutral-200"
            >
              Clear
            </button>
          )}
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
            OpenAI Connected
          </span>
        </div>
      </div>

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-neutral-900/60 p-3 text-sm">
        {messages.length === 0 && (
          <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/80 p-3 text-xs text-neutral-400">
            💡 Example questions:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>&quot;How is my agent performing today?&quot;</li>
              <li>&quot;Explain my current PnL risk.&quot;</li>
              <li>&quot;What should I watch from this portfolio?&quot;</li>
              <li>&quot;Buy 10 USDC worth of SOL&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs md:text-sm ${
                m.role === "user"
                  ? "bg-sky-500 text-black"
                  : "bg-neutral-800/90 text-neutral-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {pendingTrade && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Trade Confirmation Required
              </p>
              <p className="text-xs text-amber-300/80">
                Review the details before executing
              </p>
            </div>
          </div>
          <div className="mb-3 space-y-1.5 rounded-lg bg-neutral-900/60 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">From:</span>
              <span className="font-semibold text-neutral-100">
                {pendingTrade.amount} {pendingTrade.fromToken}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">To:</span>
              <span className="font-semibold text-neutral-100">
                {pendingTrade.toToken}
              </span>
            </div>
            {pendingTrade.reason && (
              <div className="flex justify-between">
                <span className="text-neutral-400">Reason:</span>
                <span className="text-neutral-100">{pendingTrade.reason}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExecuteTrade(pendingTrade)}
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ✓ Confirm & Execute
            </button>
            <button
              onClick={() => {
                setPendingTrade(null);
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "assistant",
                    content: "Trade cancelled. How else can I help you?",
                  },
                ]);
              }}
              disabled={loading}
              className="flex-1 rounded-lg bg-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-100 transition-all hover:bg-neutral-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className="mt-1 flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask something about your agent..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="flex-1 rounded-lg border border-neutral-700/70 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-sky-400/80 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-70"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-sky-500/40 transition-all hover:shadow-sky-500/60 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
}
