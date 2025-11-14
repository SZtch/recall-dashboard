// src/pages/Dashboard.jsx
import SolanaIcon from "../assets/chains/solana.svg";
import EthereumIcon from "../assets/chains/eth.svg";
import BaseIcon from "../assets/chains/base.svg";
import PolygonIcon from "../assets/chains/polygon.svg";
import OptimismIcon from "../assets/chains/optimism.svg";
import ArbitrumIcon from "../assets/chains/arbitrum.svg";
import BscIcon from "../assets/chains/bsc.svg";
import { useState, useEffect } from "react";
import ApiKeyForm from "../components/ApiKeyForm";
import PnlChart from "../components/PnlChart";
import Chatbot from "../components/Chatbot.jsx";
import {
  getBalances,
  getHistory,
  getPnlUnrealized,
  executeTrade,
} from "../api/backend";
import RecallLogo from "../assets/recall-logo.png";

const CHAIN_OPTIONS = [
  { id: "solana", label: "Solana", icon: SolanaIcon },
  { id: "ethereum", label: "Ethereum", icon: EthereumIcon },
  { id: "base", label: "Base", icon: BaseIcon },
  { id: "polygon", label: "Polygon", icon: PolygonIcon },
  { id: "optimism", label: "Optimism", icon: OptimismIcon },
  { id: "arbitrum", label: "Arbitrum", icon: ArbitrumIcon },
  { id: "bsc", label: "BSC", icon: BscIcon },
];

// ---------------- HELPER FUNCTIONS ----------------

function normalizeBalances(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw?.balances)
    ? raw.balances
    : Array.isArray(raw)
    ? raw
    : [];
  return list.map((b, i) => ({
    id: i,
    token: b.symbol || b.token || "?",
    amount: Number(b.amount || 0),
    usd: Number(b.value || b.usdValue || 0),
    chain: b.specificChain || b.chain || "-",
  }));
}

function normalizeHistory(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw?.trades)
    ? raw.trades
    : Array.isArray(raw)
    ? raw
    : [];
  return list.map((t, i) => ({
    id: i,
    from: t.fromTokenSymbol || "?",
    to: t.toTokenSymbol || "?",
    fromAmount: Number(t.fromAmount || 0),
    toAmount: Number(t.toAmount || 0),
    reason: t.reason || "-",
    time: (t.timestamp || "").slice(0, 19),
  }));
}

// ---------------- LOADING SKELETON ----------------

function TableSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex animate-pulse gap-4">
          <div className="h-4 w-20 rounded bg-neutral-800/50" />
          <div className="h-4 flex-1 rounded bg-neutral-800/50" />
          <div className="h-4 w-24 rounded bg-neutral-800/50" />
          <div className="h-4 w-16 rounded bg-neutral-800/50" />
        </div>
      ))}
    </div>
  );
}

// ---------------- EMPTY STATE ----------------

function EmptyState({ icon, title, description }) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/30">
          {icon}
        </div>
        <p className="text-sm font-medium text-neutral-400">{title}</p>
        <p className="mt-1 text-xs text-neutral-600">{description}</p>
      </div>
    </div>
  );
}

// ======================== CHAIN SELECT ========================

function ChainSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);

  const selected =
    CHAIN_OPTIONS.find((c) => c.id === value) || CHAIN_OPTIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 outline-none transition-all duration-200 focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
      >
        <span className="flex items-center gap-2">
          <img
            src={selected.icon}
            alt={selected.label}
            className="h-4 w-4"
          />
          <span>{selected.label}</span>
        </span>
        <svg
          className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-neutral-800/80 bg-neutral-950/95 shadow-xl backdrop-blur">
          {CHAIN_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-800/80 ${
                c.id === selected.id ? "bg-neutral-900/80" : ""
              }`}
            >
              <img src={c.icon} alt={c.label} className="h-4 w-4" />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================== BUY PANEL ========================

function BuyPanel({ apiKey, env, onAfterTrade }) {
  const [mode, setMode] = useState("single");
  const [fromChain, setFromChain] = useState("solana");
  const [toChain, setToChain] = useState("solana");
  const [loading, setLoading] = useState(false);

  const [buyToToken, setBuyToToken] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyReason, setBuyReason] = useState("");

  const [batchToToken, setBatchToToken] = useState("");
  const [batchTotal, setBatchTotal] = useState("");
  const [batchStep, setBatchStep] = useState("");
  const [batchReason, setBatchReason] = useState("");

  const [t2tFromToken, setT2tFromToken] = useState("");
  const [t2tToToken, setT2tToToken] = useState("");
  const [t2tAmount, setT2tAmount] = useState("");
  const [t2tReason, setT2tReason] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!apiKey) return;

    try {
      setLoading(true);

      if (mode === "single") {
        if (!buyToToken || !buyAmount) {
          alert("Please fill token and amount first.");
        } else {
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: "USDC",
            toToken: buyToToken,
            amount: buyAmount,
            reason: buyReason || "BUY",
          });
          alert("Single buy executed successfully!");
        }
      } else if (mode === "batch") {
        const total = Number(batchTotal || 0);
        const step = Number(batchStep || 0);
        if (!batchToToken || !total || !step) {
          alert("Please fill token, total USDC, and per trade.");
        } else {
          let spent = 0;
          while (spent + 1e-12 < total) {
            const amt = Math.min(step, total - spent);
            await executeTrade(apiKey, env, {
              fromChainKey: fromChain,
              toChainKey: toChain,
              fromToken: "USDC",
              toToken: batchToToken,
              amount: amt,
              reason: batchReason || "BATCH BUY",
            });
            spent += amt;
          }
          alert("Batch buy completed successfully!");
        }
      } else if (mode === "t2t") {
        if (!t2tFromToken || !t2tToToken || !t2tAmount) {
          alert("Please fill all token and amount fields.");
        } else {
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: t2tFromToken,
            toToken: t2tToToken,
            amount: t2tAmount,
            reason: t2tReason || "TOKEN TO TOKEN",
          });
          alert("Token swap executed successfully!");
        }
      }

      if (onAfterTrade) onAfterTrade();
    } catch (err) {
      console.error(err);
      alert(`Trade failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="group relative overflow-hidden rounded-2xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black/95 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30 hover:shadow-emerald-500/10"
      >
        {/* Top accent border */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

        {/* Section Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">
              Buy Control
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-600">
              Execute single, batch, or token-to-token buys
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <svg
              className="h-4 w-4 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mb-6 inline-flex w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-neutral-900/60 p-1 text-[10px] font-bold uppercase tracking-[0.15em] md:w-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "single"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode("batch")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "batch"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Batch
          </button>
          <button
            type="button"
            onClick={() => setMode("t2t")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "t2t"
                ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Token → Token
          </button>
        </div>

        {/* Chain Selection */}
<div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
      From Chain
    </label>
    <ChainSelect value={fromChain} onChange={setFromChain} />
  </div>
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
      To Chain
    </label>
    <ChainSelect value={toChain} onChange={setToChain} />
  </div>
</div>


        {/* Mode-specific Fields */}
        <div className="space-y-4">
          {mode === "single" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  To Token{" "}
                  <span className="text-neutral-600">(symbol or address)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIF, BONK, SOL"
                  value={buyToToken}
                  onChange={(e) => setBuyToToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Amount <span className="text-emerald-400">(USDC)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.0"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Reason{" "}
                    <span className="text-neutral-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="BUY / DCA / etc."
                    value={buyReason}
                    onChange={(e) => setBuyReason(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </>
          )}

          {mode === "batch" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  To Token{" "}
                  <span className="text-neutral-600">(symbol or address)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIF"
                  value={batchToToken}
                  onChange={(e) => setBatchToToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Total <span className="text-emerald-400">(USDC)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="100"
                    value={batchTotal}
                    onChange={(e) => setBatchTotal(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Per Trade{" "}
                    <span className="text-emerald-400">(USDC)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="10"
                    value={batchStep}
                    onChange={(e) => setBatchStep(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  Reason{" "}
                  <span className="text-neutral-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="BATCH BUY / DCA"
                  value={batchReason}
                  onChange={(e) => setBatchReason(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </>
          )}

          {mode === "t2t" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    From Token
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SOL"
                    value={t2tFromToken}
                    onChange={(e) => setT2tFromToken(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    To Token
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WIF"
                    value={t2tToToken}
                    onChange={(e) => setT2tToToken(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Amount{" "}
                    <span className="text-neutral-600">(token)</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="0.0"
                    value={t2tAmount}
                    onChange={(e) => setT2tAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Reason{" "}
                    <span className="text-neutral-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Strategy / Rotate"
                    value={t2tReason}
                    onChange={(e) => setT2tReason(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="group/btn relative mt-6 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 py-3 text-xs font-bold uppercase tracking-[0.18em] text-black shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Executing Trade...
              </>
            ) : (
              <>
                Execute Buy
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </span>
        </button>
      </form>

      {/* Side Tips Panel */}
      <div className="hidden flex-col justify-between rounded-2xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/50 to-black/50 p-6 backdrop-blur-xl xl:flex">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <svg
                className="h-4 w-4 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-neutral-200">Buy Tips</p>
          </div>
          <ul className="space-y-2.5 text-sm text-neutral-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">•</span>
              <span>
                Default source token is{" "}
                <span className="font-medium text-emerald-300">USDC</span>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">•</span>
              <span>
                Use{" "}
                <span className="font-medium text-emerald-300">Batch Buy</span> for
                DCA-style entries
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">•</span>
              <span>
                <span className="font-medium text-emerald-300">Token → Token</span>{" "}
                rotates holdings without exiting to stables
              </span>
            </li>
          </ul>
        </div>
        <div className="mt-6 rounded-lg border border-neutral-800/40 bg-neutral-900/30 p-3">
          <p className="text-xs text-neutral-500">
            ⚡ Auto-refresh every{" "}
            <span className="font-medium text-neutral-300">20 seconds</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ======================== SELL PANEL ========================

function SellPanel({ apiKey, env, onAfterTrade }) {
  const [mode, setMode] = useState("single");
  const [fromChain, setFromChain] = useState("solana");
  const [toChain, setToChain] = useState("solana");
  const [loading, setLoading] = useState(false);

  const [sellToken, setSellToken] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellReason, setSellReason] = useState("");

  const [batchToken, setBatchToken] = useState("");
  const [batchTotal, setBatchTotal] = useState("");
  const [batchStep, setBatchStep] = useState("");
  const [batchReason, setBatchReason] = useState("");

  const [t2tFromToken, setT2tFromToken] = useState("");
  const [t2tToToken, setT2tToToken] = useState("");
  const [t2tAmount, setT2tAmount] = useState("");
  const [t2tReason, setT2tReason] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!apiKey) return;

    try {
      setLoading(true);

      if (mode === "single") {
        if (!sellToken || !sellAmount) {
          alert("Please fill token and amount first.");
        } else {
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: sellToken,
            toToken: "USDC",
            amount: sellAmount,
            reason: sellReason || "SELL",
          });
          alert("Single sell executed successfully!");
        }
      } else if (mode === "batch") {
        const total = Number(batchTotal || 0);
        const step = Number(batchStep || 0);
        if (!batchToken || !total || !step) {
          alert("Please fill token, total amount, and per trade.");
        } else {
          let sold = 0;
          while (sold + 1e-12 < total) {
            const amt = Math.min(step, total - sold);
            await executeTrade(apiKey, env, {
              fromChainKey: fromChain,
              toChainKey: toChain,
              fromToken: batchToken,
              toToken: "USDC",
              amount: amt,
              reason: batchReason || "BATCH SELL",
            });
            sold += amt;
          }
          alert("Batch sell completed successfully!");
        }
      } else if (mode === "t2t") {
        if (!t2tFromToken || !t2tToToken || !t2tAmount) {
          alert("Please fill all token and amount fields.");
        } else {
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: t2tFromToken,
            toToken: t2tToToken,
            amount: t2tAmount,
            reason: t2tReason || "TOKEN TO TOKEN",
          });
          alert("Token swap executed successfully!");
        }
      }

      if (onAfterTrade) onAfterTrade();
    } catch (err) {
      console.error(err);
      alert(`Trade failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="group relative overflow-hidden rounded-2xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black/95 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-rose-500/30 hover:shadow-rose-500/10"
      >
        {/* Top accent border */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />

        {/* Section Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">
              Sell Control
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-600">
              Execute single, batch, or token-to-token sells
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
            <svg
              className="h-4 w-4 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
              />
            </svg>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="mb-6 inline-flex w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-neutral-900/60 p-1 text-[10px] font-bold uppercase tracking-[0.15em] md:w-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "single"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Single
          </button>
          <button
            type="button"
            onClick={() => setMode("batch")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "batch"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Batch
          </button>
          <button
            type="button"
            onClick={() => setMode("t2t")}
            className={`flex-1 rounded-lg px-4 py-2 transition-all duration-200 md:flex-none ${
              mode === "t2t"
                ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
            }`}
          >
            Token → Token
          </button>
        </div>

        {/* Chain Selection */}
<div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
      From Chain
    </label>
    <ChainSelect value={fromChain} onChange={setFromChain} />
  </div>
  <div>
    <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
      To Chain
    </label>
    <ChainSelect value={toChain} onChange={setToChain} />
  </div>
</div>

        {/* Mode-specific Fields */}
        <div className="space-y-4">
          {mode === "single" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  Token{" "}
                  <span className="text-neutral-600">(symbol or address)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIF, BONK, SOL"
                  value={sellToken}
                  onChange={(e) => setSellToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Amount{" "}
                    <span className="text-neutral-600">(token)</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="0.0"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Reason{" "}
                    <span className="text-neutral-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="SELL / TP / SL"
                    value={sellReason}
                    onChange={(e) => setSellReason(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </>
          )}

          {mode === "batch" && (
            <>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  Token{" "}
                  <span className="text-neutral-600">(symbol or address)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIF"
                  value={batchToken}
                  onChange={(e) => setBatchToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Total{" "}
                    <span className="text-neutral-600">(token)</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="100"
                    value={batchTotal}
                    onChange={(e) => setBatchTotal(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Per Trade{" "}
                    <span className="text-neutral-600">(token)</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="10"
                    value={batchStep}
                    onChange={(e) => setBatchStep(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                  Reason{" "}
                  <span className="text-neutral-600">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="BATCH SELL"
                  value={batchReason}
                  onChange={(e) => setBatchReason(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            </>
          )}

          {mode === "t2t" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    From Token
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WIF"
                    value={t2tFromToken}
                    onChange={(e) => setT2tFromToken(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    To Token
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. USDC"
                    value={t2tToToken}
                    onChange={(e) => setT2tToToken(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Amount{" "}
                    <span className="text-neutral-600">(token)</span>
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="0.0"
                    value={t2tAmount}
                    onChange={(e) => setT2tAmount(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
                    Reason{" "}
                    <span className="text-neutral-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Strategy / Exit"
                    value={t2tReason}
                    onChange={(e) => setT2tReason(e.target.value)}
                    className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-rose-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="group/btn relative mt-6 w-full overflow-hidden rounded-xl bg-gradient-to-r from-rose-500 to-amber-400 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-300 group-hover/btn:opacity-100" />
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Executing Trade...
              </>
            ) : (
              <>
                Execute Sell
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </>
            )}
          </span>
        </button>
      </form>

      {/* Side Tips Panel */}
      <div className="hidden flex-col justify-between rounded-2xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/50 to-black/50 p-6 backdrop-blur-xl xl:flex">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10">
              <svg
                className="h-4 w-4 text-rose-400"
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
            <p className="text-sm font-semibold text-neutral-200">
              Risk Reminder
            </p>
          </div>
          <ul className="space-y-2.5 text-sm text-neutral-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-rose-400">•</span>
              <span>
                Use{" "}
                <span className="font-medium text-rose-300">Batch Sell</span> to
                scale out gradually
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-rose-400">•</span>
              <span>
                <span className="font-medium text-rose-300">Token → Token</span> is
                useful to rotate into stables
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-rose-400">•</span>
              <span>Always double-check your position size before executing</span>
            </li>
          </ul>
        </div>
        <div className="mt-6 rounded-lg border border-neutral-800/40 bg-neutral-900/30 p-3">
          <p className="text-xs text-neutral-500">
            🔒 All orders routed via{" "}
            <span className="font-medium text-neutral-300">Recall API</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ======================= CHATBOT PANEL =======================

function ChatbotPanel({
  openaiKey,
  onSaveKey,
  balances,
  pnl,
  env,
  agentName,
}) {
  const [tempKey, setTempKey] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasKey = !!openaiKey;

  const contextSummary = (() => {
    const totalUsd =
      (balances || []).reduce((sum, b) => sum + (b.usd || 0), 0) || 0;
    return `Environment: ${env}. Agent: ${agentName || "-"}.
Total balance (approx): $${totalUsd.toFixed(2)}.
Number of positions: ${(pnl || []).length}.`;
  })();

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
                "You are an assistant helping a user understand their Recall trading agent performance. Be concise and practical.",
            },
            {
              role: "system",
              content: `Context: ${contextSummary}`,
            },
            ...newMessages,
          ],
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `OpenAI API error: ${res.status}`
        );
      }

      const data = await res.json();
      const reply =
        data?.choices?.[0]?.message?.content ||
        "I couldn't generate a response. Please try again.";

      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setError(
        "Failed to contact OpenAI. Please check your API key or try again."
      );
    } finally {
      setLoading(false);
    }
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
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          OpenAI Connected
        </span>
      </div>

      <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-xl bg-neutral-900/60 p-3 text-sm">
        {messages.length === 0 && (
          <div className="rounded-lg border border-neutral-800/80 bg-neutral-900/80 p-3 text-xs text-neutral-400">
            💡 Example questions:
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>“How is my agent performing today?”</li>
              <li>“Explain my current PnL risk.”</li>
              <li>“What should I watch from this portfolio?”</li>
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
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs md:text-sm ${
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

// ======================= MAIN DASHBOARD =====================

export default function Dashboard() {
  const [agentName, setAgentName] = useState(null);
  const [apiKey, setApiKey] = useState(null);
  const [env, setEnv] = useState("sandbox");
  const [balances, setBalances] = useState(null);
  const [history, setHistory] = useState(null);
  const [pnlData, setPnlData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("balances");

  const [openaiKey, setOpenaiKey] = useState(null);

  const isConnected = !!(agentName && apiKey);

  useEffect(() => {
    const stored = localStorage.getItem("recallSession");
    if (stored) {
      try {
        const saved = JSON.parse(stored);
        if (saved.agentName && saved.apiKey && saved.env) {
          connect(saved.agentName, saved.apiKey, saved.env, { fromStorage: true });
        }
      } catch {
        // ignore
      }
    }

    const storedOpenAI = localStorage.getItem("recallOpenAIKey");
    if (storedOpenAI) {
      setOpenaiKey(storedOpenAI);
    }
  }, []);

  async function connect(agent, key, environment, opts = {}) {
    setAgentName(agent);
    setApiKey(key);
    setEnv(environment);

    try {
      setLoading(true);
      setErrorMsg("");

      if (!opts.fromStorage) {
        localStorage.setItem(
          "recallSession",
          JSON.stringify({ agentName: agent, apiKey: key, env: environment })
        );
      }

      const [bal, his, pnl] = await Promise.all([
        getBalances(key, environment),
        getHistory(key, environment),
        getPnlUnrealized(key, environment),
      ]);

      setBalances(bal);
      setHistory(his);
      setPnlData(pnl);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        "Failed to fetch data from backend. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  async function refreshData() {
    if (!apiKey || !env) return;
    try {
      setRefreshing(true);
      const [bal, his, pnl] = await Promise.all([
        getBalances(apiKey, env),
        getHistory(apiKey, env),
        getPnlUnrealized(apiKey, env),
      ]);
      setBalances(bal);
      setHistory(his);
      setPnlData(pnl);
    } catch (err) {
      console.error("Refresh error", err);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!apiKey || !env) return;
    const intv = setInterval(() => {
      refreshData();
    }, 20000);
    return () => clearInterval(intv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, env]);

  function saveOpenAIKey(key) {
    const trimmed = (key || "").trim();
    if (!trimmed) return;
    setOpenaiKey(trimmed);
    localStorage.setItem("recallOpenAIKey", trimmed);
  }

  function logout() {
    setAgentName(null);
    setApiKey(null);
    setEnv("sandbox");
    setBalances(null);
    setHistory(null);
    setPnlData([]);
    setErrorMsg("");
    setActiveTab("balances");
    setOpenaiKey(null);
    localStorage.removeItem("recallSession");
    localStorage.removeItem("recallOpenAIKey");
  }

  const balanceRows = normalizeBalances(balances);
  const historyRows = normalizeHistory(history);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ============ HERO (NOT CONNECTED) ============ */}
      {!isConnected && (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-black">
          <div className="absolute left-4 top-4 z-10 flex items-center gap-2 md:left-6 md:top-6 md:gap-3 lg:left-10 lg:top-8">
            <img
              src={RecallLogo}
              alt="Recall Logo"
              className="h-8 w-auto object-contain md:h-10 lg:h-12"
            />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-300 sm:inline sm:text-xs md:text-sm">
              Recall Agent Dashboard
            </span>
          </div>

          <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center md:py-20">
            <h1 className="mb-3 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl md:mb-4 md:text-6xl lg:text-7xl">
              Enter the Arena
            </h1>

            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 md:mb-2 md:text-xs">
              Connect to Recall
            </p>
            <p className="mb-8 max-w-xl px-4 text-xs leading-relaxed text-neutral-400 md:mb-12 md:text-sm lg:text-base">
              Enter your credentials to access the dashboard and monitor your
              agent&apos;s performance across chains.
            </p>

            <div className="relative w-full max-w-3xl">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-[150vw] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-rose-500 via-amber-300 to-rose-500 opacity-80 blur-3xl" />
              <div className="relative z-10 flex justify-center">
                <ApiKeyForm onConnect={connect} />
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ============ DASHBOARD (CONNECTED) ============ */}
      {isConnected && (
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-8 pt-4 md:px-6 md:pb-10 md:pt-6 lg:px-6 lg:pt-8">
          <header className="mb-6 flex flex-col items-start justify-between gap-3 md:mb-8 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <img
                src={RecallLogo}
                alt="Recall Logo"
                className="h-12 w-12 object-contain md:h-16 md:w-16"
              />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-neutral-500 md:text-[10px]">
                  Recall Agent Dashboard
                </div>
                <h1 className="mt-0.5 text-xl font-bold md:mt-1 md:text-2xl lg:text-3xl">
                  Welcome back,{" "}
                  <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                    {agentName}
                  </span>
                </h1>
                <div className="mt-0.5 text-[10px] text-neutral-500 md:mt-1 md:text-xs">
                  Environment:{" "}
                  <span className="font-medium uppercase text-neutral-300">
                    {env}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 md:w-auto md:gap-3">
              {refreshing && (
                <div className="flex items-center gap-1.5 text-[10px] text-sky-400 md:gap-2 md:text-xs">
                  <svg
                    className="h-3 w-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Updating...
                </div>
              )}
              <button
                onClick={refreshData}
                className="flex-1 rounded-lg border border-neutral-700/70 bg-neutral-900/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-200 transition-all hover:border-sky-400/80 hover:bg-neutral-900/80 hover:text-sky-300 md:flex-none md:px-4 md:py-2 md:text-[11px]"
              >
                Refresh
              </button>
              <button
                onClick={logout}
                className="flex-1 rounded-lg border border-neutral-700/70 bg-neutral-900/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-200 transition-all hover:border-rose-500/80 hover:bg-neutral-900/80 hover:text-rose-300 md:flex-none md:px-4 md:py-2 md:text-[11px]"
              >
                Logout
              </button>
            </div>
          </header>

          {loading && (
            <div className="mb-4 flex items-center gap-2 text-sm text-yellow-400">
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading dashboard data...
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              ⚠️ {errorMsg}
            </div>
          )}

          <section className="relative overflow-hidden rounded-2xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black shadow-2xl shadow-neutral-950/50">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

            <div className="overflow-x-auto border-b border-neutral-800/50 bg-neutral-950/50 px-3 pt-3 md:px-5 md:pt-5">
              <div className="inline-flex min-w-full items-center gap-1 rounded-t-xl bg-neutral-900/60 p-0.5 text-[9px] font-bold uppercase tracking-[0.15em] md:min-w-0 md:gap-1.5 md:p-1 md:text-[10px]">
                <button
                  onClick={() => setActiveTab("balances")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "balances"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  Balances
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "history"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  History
                </button>
                <button
                  onClick={() => setActiveTab("pnl")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "pnl"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  PNL
                </button>
                <button
                  onClick={() => setActiveTab("buy")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "buy"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setActiveTab("sell")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "sell"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  Sell
                </button>
                <button
                  onClick={() => setActiveTab("chatbot")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 transition-all duration-200 md:flex-none md:px-4 md:py-2.5 ${
                    activeTab === "chatbot"
                      ? "bg-purple-500 text-white shadow-lg shadow-purple-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  Chatbot
                </button>
              </div>
            </div>

            <div className="p-3 md:p-5">
              {activeTab === "balances" && (
                <div>
                  {loading ? (
                    <TableSkeleton />
                  ) : balanceRows.length === 0 ? (
                    <EmptyState
                      icon={
                        <svg
                          className="h-8 w-8 text-neutral-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      }
                      title="No balances found"
                      description="Your wallet is empty. Execute trades to see balances here."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                          <tr className="text-left">
                            <th className="py-3 font-semibold">Token</th>
                            <th className="py-3 text-right font-semibold">
                              Amount
                            </th>
                            <th className="py-3 text-right font-semibold">
                              USD Value
                            </th>
                            <th className="py-3 font-semibold">Chain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceRows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-neutral-900/60 transition-colors hover:bg-neutral-900/40"
                            >
                              <td className="py-3.5 pr-4 font-semibold text-neutral-100">
                                {row.token}
                              </td>
                              <td className="py-3.5 pr-4 text-right font-mono text-neutral-300">
                                {row.amount.toFixed(6)}
                              </td>
                              <td className="py-3.5 pr-4 text-right font-mono text-sky-300">
                                ${row.usd.toFixed(2)}
                              </td>
                              <td className="py-3.5 pr-4 text-xs text-neutral-400">
                                {row.chain}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div>
                  {loading ? (
                    <TableSkeleton />
                  ) : historyRows.length === 0 ? (
                    <EmptyState
                      icon={
                        <svg
                          className="h-8 w-8 text-neutral-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      }
                      title="No trade history"
                      description="Execute trades to see your transaction history here."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                          <tr className="text-left">
                            <th className="py-3 font-semibold">Pair</th>
                            <th className="py-3 text-right font-semibold">
                              From
                            </th>
                            <th className="py-3 text-right font-semibold">
                              To
                            </th>
                            <th className="py-3 font-semibold">Reason</th>
                            <th className="py-3 font-semibold">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRows.map((trow) => (
                            <tr
                              key={trow.id}
                              className="border-b border-neutral-900/60 transition-colors hover:bg-neutral-900/40"
                            >
                              <td className="py-3.5 pr-4 font-semibold text-neutral-100">
                                {trow.from} → {trow.to}
                              </td>
                              <td className="py-3.5 pr-4 text-right font-mono text-neutral-300">
                                {trow.fromAmount.toFixed(4)}
                              </td>
                              <td className="py-3.5 pr-4 text-right font-mono text-sky-300">
                                {trow.toAmount.toFixed(4)}
                              </td>
                              <td className="py-3.5 pr-4 text-xs text-neutral-400">
                                {trow.reason}
                              </td>
                              <td className="py-3.5 pr-4 text-xs text-neutral-500">
                                {trow.time}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "pnl" && (
                <div>
                  <PnlChart data={pnlData} />
                  {pnlData.length > 0 && (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-500">
                          <tr className="text-left">
                            <th className="py-3 font-semibold">Token</th>
                            <th className="py-3 text-right font-semibold">
                              Amount
                            </th>
                            <th className="py-3 text-right font-semibold">
                              Avg Buy
                            </th>
                            <th className="py-3 text-right font-semibold">
                              Current Value
                            </th>
                            <th className="py-3 text-right font-semibold">
                              PNL
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pnlData.map((p, i) => (
                            <tr
                              key={i}
                              className="border-b border-neutral-900/60 transition-colors hover:bg-neutral-900/40"
                            >
                              <td className="py-3.5 font-semibold text-neutral-100">
                                {p.token}
                              </td>
                              <td className="py-3.5 text-right font-mono text-neutral-300">
                                {p.amount.toFixed(4)}
                              </td>
                              <td className="py-3.5 text-right font-mono text-neutral-300">
                                ${p.avgBuy.toFixed(4)}
                              </td>
                              <td className="py-3.5 text-right font-mono text-sky-300">
                                ${p.currentValue.toFixed(2)}
                              </td>
                              <td
                                className={`py-3.5 text-right font-mono font-semibold ${
                                  p.pnl >= 0
                                    ? "text-emerald-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "buy" && (
                <BuyPanel apiKey={apiKey} env={env} onAfterTrade={refreshData} />
              )}

              {activeTab === "sell" && (
                <SellPanel apiKey={apiKey} env={env} onAfterTrade={refreshData} />
              )}

              {activeTab === "chatbot" && (
                <ChatbotPanel
                  openaiKey={openaiKey}
                  onSaveKey={saveOpenAIKey}
                  balances={balanceRows}
                  pnl={pnlData}
                  env={env}
                  agentName={agentName}
                />
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
