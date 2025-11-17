// src/components/chatbot/ChatbotPanel.jsx
import { useState, useEffect, useRef } from "react";
import { executeTrade } from "../../api/backend";
import { showSuccess, showError } from "../../utils/toast";
import { validateTradeBalance } from "../../hooks/useTrade";
import { getMultipleCryptoPrices, formatPrice, formatChange, formatMarketCap } from "../../api/crypto";

export default function ChatbotPanel({
  openaiKey,
  onSaveKey,
  balances,
  pnl,
  env,
  agentName,
  apiKey,
  competitionId,
  onExecuteTrade,
  onClose,
}) {
  const [tempKey, setTempKey] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingTrade, setPendingTrade] = useState(null);

  const hasKey = !!openaiKey;
  const messagesEndRef = useRef(null);

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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

      await executeTrade(apiKey, env, competitionId, {
        fromChainKey: "solana", // Default to solana (cross-chain disabled)
        toChainKey: "solana", // Must be same as fromChainKey
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
                "Lu adalah asisten trading crypto yang asik dan gaul. Gaya bahasa lu santai tapi tetep informatif. Gunain bahasa slang Indonesia yang natural kayak: 'gokil', 'mantul', 'anjlok', 'meluncur', 'pumping', 'dumping', 'FOMO', 'hold/hodl', 'bullish', 'bearish', 'to the moon', 'gaspol', 'cuan', 'boncos', 'nyangkut', dll. Jangan terlalu formal. Panggil user dengan 'lu/lo' dan diri sendiri 'gue/gw'. Jawab singkat, to the point, tapi tetep helpful. Kalo ditanya soal harga crypto, fetch data real-time. Kalo execute trade, confirm dulu dengan jelas. Be friendly, be cool, be yourself!",
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
            {
              type: "function",
              function: {
                name: "get_crypto_price",
                description:
                  "Get real-time cryptocurrency price information. Use this when the user asks about crypto prices, market data, or wants to compare coins.",
                parameters: {
                  type: "object",
                  properties: {
                    symbols: {
                      type: "array",
                      items: {
                        type: "string",
                      },
                      description:
                        "Array of cryptocurrency symbols (e.g., ['BTC', 'ETH', 'SOL']). Supports: BTC, ETH, SOL, USDC, USDT, BNB, ADA, DOT, MATIC, AVAX, LINK, UNI, ATOM, XRP, DOGE, SHIB, ARB, OP, and more.",
                    },
                  },
                  required: ["symbols"],
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

        if (toolCall.function.name === "get_crypto_price") {
          // Handle crypto price request
          const params = JSON.parse(toolCall.function.arguments);
          const symbols = params.symbols || [];

          try {
            const pricesData = await getMultipleCryptoPrices(symbols);

            // Format price response
            let priceMessage = "📈 **Cryptocurrency Prices**\n\n";

            pricesData.forEach((coin) => {
              if (coin.error) {
                priceMessage += `❌ ${coin.symbol}: Not found\n\n`;
              } else {
                const changeIcon = coin.change24h >= 0 ? "📈" : "📉";
                const changeColor = coin.change24h >= 0 ? "+" : "";

                priceMessage += `🪙 **${coin.symbol}**\n`;
                priceMessage += `• Price: ${formatPrice(coin.price)}\n`;
                priceMessage += `• 24h Change: ${changeColor}${formatChange(coin.change24h)} ${changeIcon}\n`;
                priceMessage += `• Market Cap: ${formatMarketCap(coin.marketCap)}\n\n`;
              }
            });

            setMessages([
              ...newMessages,
              {
                role: "assistant",
                content: priceMessage.trim(),
              },
            ]);
            showSuccess("💬 Bot replied!");
          } catch (error) {
            setMessages([
              ...newMessages,
              {
                role: "assistant",
                content: `❌ Failed to fetch crypto prices: ${error.message}`,
              },
            ]);
          }
        } else if (toolCall.function.name === "execute_trade") {
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
        showSuccess("💬 Bot replied!");
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
      <div className="mx-auto max-w-md rounded-xl border border-neutral-800/60 bg-neutral-950/90 p-5 text-center shadow-xl sm:rounded-2xl sm:p-6">
        <h2 className="mb-2 text-base font-semibold text-neutral-100 sm:mb-3 sm:text-lg">
          Enable Chatbot
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-neutral-400 sm:mb-4 sm:text-base">
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
          className="mb-4 w-full rounded-lg border border-neutral-700/70 bg-neutral-900/70 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-purple-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-purple-500/20 sm:mb-3 sm:px-3 sm:py-2.5"
        />

        <button
          onClick={() => {
            if (!tempKey.trim()) return;
            onSaveKey(tempKey);
            setTempKey("");
          }}
          className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-sky-500 py-3.5 text-sm font-semibold text-black shadow-lg shadow-purple-500/40 transition-all active:scale-98 hover:shadow-purple-500/60 sm:py-2.5"
        >
          Save & Activate
        </button>

        <p className="mt-4 text-xs text-neutral-500 sm:mt-3 sm:text-[11px]">
          You can remove this key anytime by logging out.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card mx-auto flex min-h-[500px] max-h-[calc(100vh-200px)] max-w-3xl flex-col rounded-2xl shadow-emerald p-4 sm:h-[550px] sm:rounded-3xl sm:p-5 md:h-[600px] animate-scale-in">
      {/* Enhanced header */}
      <div className="mb-4 flex flex-col gap-3 border-b border-neutral-800/50 pb-4 sm:mb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-3">
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gradient-emerald sm:text-sm">
            AI Assistant
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-400 sm:text-[11px]">
            Your trading companion with real-time insights
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="ripple rounded-lg glass px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 transition-all active:scale-95 hover:bg-neutral-800/80 hover:text-neutral-200 sm:px-2.5 sm:py-1.5 sm:text-[11px]"
            >
              Clear
            </button>
          )}
          <span className="rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 px-3 py-1.5 text-[10px] font-medium text-emerald-300 animate-pulse-slow sm:px-3 sm:py-1 sm:text-[11px]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping"></span>
            Connected
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-neutral-400 transition-colors hover:text-white"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Enhanced message area */}
      <div className="mb-3 flex-1 space-y-3 overflow-y-auto rounded-2xl glass p-3 text-sm sm:mb-3 sm:space-y-2.5 sm:p-4">
        {messages.length === 0 && (
          <div className="glass-panel rounded-xl p-4 text-xs text-neutral-300 animate-fade-in sm:p-3 sm:text-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💡</span>
              <span className="font-semibold text-emerald-400">Try asking:</span>
            </div>
            <ul className="mt-2 space-y-2 pl-7 sm:mt-1 sm:space-y-1.5 sm:pl-6">
              <li className="relative before:absolute before:left-[-1rem] before:content-['→'] before:text-emerald-400">&quot;How is my agent performing today?&quot;</li>
              <li className="relative before:absolute before:left-[-1rem] before:content-['→'] before:text-emerald-400">&quot;Explain my current PnL risk.&quot;</li>
              <li className="relative before:absolute before:left-[-1rem] before:content-['→'] before:text-emerald-400">&quot;What should I watch from this portfolio?&quot;</li>
              <li className="relative before:absolute before:left-[-1rem] before:content-['→'] before:text-emerald-400">&quot;Buy 10 USDC worth of SOL&quot;</li>
            </ul>
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            } animate-slide-up`}
          >
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg sm:max-w-[80%] sm:px-3 sm:py-2 sm:text-sm transition-all hover:scale-102 ${
                m.role === "user"
                  ? "bg-gradient-to-br from-emerald-500 to-primary-600 text-white font-medium shadow-emerald"
                  : "glass-panel text-neutral-100 shadow-neutral-900/50"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Enhanced trade confirmation */}
      {pendingTrade && (
        <div className="mb-3 rounded-xl gradient-border-animated p-4 sm:mb-3 sm:p-4 animate-scale-in shadow-glow">
          <div className="mb-3 flex items-center gap-2.5 sm:gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 sm:h-8 sm:w-8">
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
              <p className="text-sm font-semibold text-amber-200 sm:text-base">
                Trade Confirmation Required
              </p>
              <p className="text-xs text-amber-300/80 sm:text-xs">
                Review the details before executing
              </p>
            </div>
          </div>
          <div className="mb-3 space-y-2 rounded-lg bg-neutral-900/60 p-3.5 text-xs sm:space-y-1.5 sm:p-3 sm:text-sm">
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
          <div className="flex gap-2.5 sm:gap-2">
            <button
              onClick={() => handleExecuteTrade(pendingTrade)}
              disabled={loading}
              className="ripple flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-primary-600 px-4 py-3 text-xs font-bold text-white shadow-emerald transition-all active:scale-95 hover:shadow-emerald-lg hover:scale-102 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2 sm:text-sm"
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
              className="ripple flex-1 rounded-lg glass px-4 py-3 text-xs font-semibold text-neutral-100 transition-all active:scale-95 hover:bg-neutral-700/80 disabled:cursor-not-allowed disabled:opacity-60 sm:py-2 sm:text-sm"
            >
              ✗ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Enhanced input area */}
      <form onSubmit={handleSend} className="mt-1 flex items-center gap-2 sm:gap-2.5">
        <input
          type="text"
          placeholder="Ask anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="glass flex-1 rounded-xl px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/30 focus:shadow-glow disabled:cursor-not-allowed disabled:opacity-70 sm:px-3 sm:py-2"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="ripple rounded-xl bg-gradient-to-r from-emerald-500 to-primary-600 px-5 py-3 text-xs font-bold text-white shadow-emerald transition-all ease-bounce-in active:scale-95 hover:shadow-glow hover:scale-102 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:px-4 sm:py-2 sm:text-sm"
        >
          {loading ? (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
          ) : "Send"}
        </button>
      </form>
    </div>
  );
}
