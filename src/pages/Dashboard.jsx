// src/pages/Dashboard.jsx
import SolanaIcon from "../assets/chains/solana.svg";
import EthereumIcon from "../assets/chains/eth.svg";
import BaseIcon from "../assets/chains/base.svg";
import PolygonIcon from "../assets/chains/polygon.svg";
import OptimismIcon from "../assets/chains/optimism.svg";
import ArbitrumIcon from "../assets/chains/arbitrum.svg";
import BscIcon from "../assets/chains/bsc.svg";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import ApiKeyForm from "../components/ApiKeyForm";
import PnlChart from "../components/PnlChart";
import ChatbotPanel from "../components/chatbot/ChatbotPanel";
import VerifyWalletPanel from "../components/VerifyWalletPanel";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {
  getBalances,
  getHistory,
  getPnlUnrealized,
  executeTrade,
} from "../api/backend";
import RecallLogo from "../assets/recall-logo.png";
import { showSuccess, showError, showLoading, dismissToast } from "../utils/toast";
import { secureSet, secureGet, secureRemove } from "../utils/secureStorage";

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
          showError("Please fill token and amount first.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing buy trade...");
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: "USDC",
            toToken: buyToToken,
            amount: buyAmount,
            reason: buyReason || "BUY",
          });
          dismissToast(toastId);
          showSuccess(`Buy executed! ${buyAmount} USDC → ${buyToToken}`);
        }
      } else if (mode === "batch") {
        const total = Number(batchTotal || 0);
        const step = Number(batchStep || 0);
        if (!batchToToken || !total || !step) {
          showError("Please fill token, total USDC, and per trade.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing batch buy...");
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
          dismissToast(toastId);
          showSuccess(`Batch buy completed! Total: ${total} USDC → ${batchToToken}`);
        }
      } else if (mode === "t2t") {
        if (!t2tFromToken || !t2tToToken || !t2tAmount) {
          showError("Please fill all token and amount fields.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing token swap...");
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: t2tFromToken,
            toToken: t2tToToken,
            amount: t2tAmount,
            reason: t2tReason || "TOKEN TO TOKEN",
          });
          dismissToast(toastId);
          showSuccess(`Token swap executed! ${t2tAmount} ${t2tFromToken} → ${t2tToToken}`);
        }
      }

      if (onAfterTrade) onAfterTrade();
    } catch (err) {
      console.error(err);
      showError(`Trade failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black/95 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/30 hover:shadow-emerald-500/10 sm:rounded-2xl sm:p-6"
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

        {/* Mode Switcher - Touch-friendly */}
        <div className="mb-5 inline-flex w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-neutral-900/60 p-1 text-[11px] font-bold uppercase tracking-[0.15em] sm:mb-6 sm:text-xs md:w-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300 sm:text-sm">
                  To Token{" "}
                  <span className="text-neutral-600">(symbol or address)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. WIF, BONK, SOL"
                  value={buyToToken}
                  onChange={(e) => setBuyToToken(e.target.value)}
                  className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-emerald-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-emerald-500/20 sm:px-3.5 sm:py-2.5"
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

        {/* Submit Button - Touch-friendly */}
        <button
          type="submit"
          disabled={loading}
          className="group/btn relative mt-5 w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-black shadow-lg shadow-emerald-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:mt-6 sm:py-3 sm:text-sm"
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
          showError("Please fill token and amount first.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing sell trade...");
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: sellToken,
            toToken: "USDC",
            amount: sellAmount,
            reason: sellReason || "SELL",
          });
          dismissToast(toastId);
          showSuccess(`Sell executed! ${sellAmount} ${sellToken} → USDC`);
        }
      } else if (mode === "batch") {
        const total = Number(batchTotal || 0);
        const step = Number(batchStep || 0);
        if (!batchToken || !total || !step) {
          showError("Please fill token, total amount, and per trade.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing batch sell...");
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
          dismissToast(toastId);
          showSuccess(`Batch sell completed! Total: ${total} ${batchToken} → USDC`);
        }
      } else if (mode === "t2t") {
        if (!t2tFromToken || !t2tToToken || !t2tAmount) {
          showError("Please fill all token and amount fields.");
          setLoading(false);
          return;
        } else {
          const toastId = showLoading("Executing token swap...");
          await executeTrade(apiKey, env, {
            fromChainKey: fromChain,
            toChainKey: toChain,
            fromToken: t2tFromToken,
            toToken: t2tToToken,
            amount: t2tAmount,
            reason: t2tReason || "TOKEN TO TOKEN",
          });
          dismissToast(toastId);
          showSuccess(`Token swap executed! ${t2tAmount} ${t2tFromToken} → ${t2tToToken}`);
        }
      }

      if (onAfterTrade) onAfterTrade();
    } catch (err) {
      console.error(err);
      showError(`Trade failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="group relative overflow-hidden rounded-xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black/95 p-5 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-rose-500/30 hover:shadow-rose-500/10 sm:rounded-2xl sm:p-6"
      >
        {/* Top accent border */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />

        {/* Section Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400 sm:text-sm">
              Sell Control
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-600 sm:text-[11px]">
              Execute single, batch, or token-to-token sells
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 sm:h-9 sm:w-9">
            <svg
              className="h-4 w-4 text-rose-400 sm:h-5 sm:w-5"
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

        {/* Mode Switcher - Touch-friendly */}
        <div className="mb-5 inline-flex w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-neutral-900/60 p-1 text-[11px] font-bold uppercase tracking-[0.15em] sm:mb-6 sm:text-xs md:w-auto">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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
            className={`flex-1 rounded-lg px-5 py-2.5 transition-all duration-200 active:scale-95 sm:py-2 md:flex-none ${
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

        {/* Submit Button - Touch-friendly */}
        <button
          type="submit"
          disabled={loading}
          className="group/btn relative mt-5 w-full overflow-hidden rounded-xl bg-gradient-to-r from-rose-500 to-amber-400 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-rose-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-rose-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:mt-6 sm:py-3 sm:text-sm"
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

// ======================= MAIN DASHBOARD =====================

export default function Dashboard() {
  const { t } = useTranslation();

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
  const [chatbotOpen, setChatbotOpen] = useState(false);

  const isConnected = !!(agentName && apiKey);

  useEffect(() => {
    const stored = secureGet("recallSession");
    if (stored) {
      try {
        if (stored.agentName && stored.apiKey && stored.env) {
          connect(stored.agentName, stored.apiKey, stored.env, { fromStorage: true });
        }
      } catch {
        // ignore
      }
    }

    const storedOpenAI = secureGet("recallOpenAIKey");
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
        secureSet("recallSession", { agentName: agent, apiKey: key, env: environment });
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
    secureSet("recallOpenAIKey", trimmed);
    showSuccess("OpenAI API key saved securely");
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
    secureRemove("recallSession");
    secureRemove("recallOpenAIKey");
    showSuccess("Logged out successfully");
  }

  const balanceRows = normalizeBalances(balances);
  const historyRows = normalizeHistory(history);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ============ HERO (NOT CONNECTED) ============ */}
      {!isConnected && (
        <div className="relative flex min-h-screen flex-col overflow-hidden bg-black">
          {/* Mobile-first logo header */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4 sm:top-4 md:left-6 md:top-6 lg:left-10 lg:top-8">
            <img
              src={RecallLogo}
              alt="Recall Logo"
              className="h-9 w-auto object-contain sm:h-10 md:h-12 lg:h-14"
            />
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-300 sm:inline sm:text-xs md:text-sm">
              Recall Agent Dashboard
            </span>
          </div>

          {/* Mobile-optimized hero section */}
          <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-20 text-center sm:px-6 sm:py-24 md:py-20">
            <h1 className="mb-4 bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:mb-5 sm:text-4xl md:mb-4 md:text-5xl lg:text-6xl xl:text-7xl">
              Enter the Arena
            </h1>

            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-400 sm:text-xs md:mb-2">
              Connect to Recall
            </p>
            <p className="mb-10 max-w-xs px-2 text-sm leading-relaxed text-neutral-400 sm:max-w-md sm:px-4 md:mb-12 md:max-w-xl md:text-base lg:text-lg">
              Enter your credentials to access the dashboard and monitor your
              agent&apos;s performance across chains.
            </p>

            <div className="relative w-full max-w-3xl px-4 sm:px-0">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-[150vw] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-rose-500 via-amber-300 to-rose-500 opacity-80 blur-3xl sm:h-44" />
              <div className="relative z-10 flex justify-center">
                <ApiKeyForm onConnect={connect} />
              </div>
            </div>
          </main>

          {/* Fixed X (Twitter) Link - Bottom Right */}
          <a
            href="https://x.com/sztch"
            target="_blank"
            rel="noopener noreferrer"
            className="group fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-neutral-700/50 bg-neutral-900/80 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:border-sky-400/50 hover:bg-neutral-800/90 hover:shadow-sky-500/30 active:scale-95 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
            aria-label="Follow on X"
          >
            <svg
              className="h-5 w-5 text-white transition-colors group-hover:text-sky-400 sm:h-5 sm:w-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      )}

      {/* ============ DASHBOARD (CONNECTED) ============ */}
      {isConnected && (
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-8 pt-4 sm:px-5 sm:pb-10 sm:pt-5 md:px-6 md:pb-12 md:pt-6 lg:px-8 lg:pt-8">
          {/* Mobile-optimized header */}
          <header className="mb-5 flex flex-col items-start justify-between gap-4 sm:mb-6 md:mb-8 md:flex-row md:items-center md:gap-4">
            <div className="flex items-center gap-3 sm:gap-3 md:gap-4">
              <img
                src={RecallLogo}
                alt="Recall Logo"
                className="h-14 w-14 object-contain sm:h-16 sm:w-16 md:h-16 md:w-16 lg:h-18 lg:w-18"
              />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500 sm:text-[11px] md:text-xs">
                  Recall Agent Dashboard
                </div>
                <h1 className="mt-1 text-lg font-bold leading-tight sm:text-xl md:mt-1 md:text-2xl lg:text-3xl">
                  Welcome back,{" "}
                  <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                    {agentName}
                  </span>
                </h1>
                <div className="mt-1 text-xs text-neutral-500 sm:text-sm md:text-xs">
                  Environment:{" "}
                  <span className="font-medium uppercase text-neutral-300">
                    {env}
                  </span>
                </div>
              </div>
            </div>

            {/* Touch-friendly action buttons */}
            <div className="flex w-full items-center gap-2 sm:gap-3 md:w-auto">
              <LanguageSwitcher />
              <a
                href="https://app.recall.network/competitions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-sky-300 transition-all active:scale-95 hover:border-sky-400 hover:bg-sky-500/20 hover:text-sky-200 sm:py-2.5 md:flex-none md:px-5 md:text-[11px]"
              >
                <svg className="h-3.5 w-3.5 sm:h-3 sm:w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                {t('header.leaderboard')}
              </a>
              <button
                onClick={logout}
                className="flex-1 rounded-lg border border-neutral-700/70 bg-neutral-900/50 px-4 py-2.5 text-xs font-medium uppercase tracking-[0.12em] text-neutral-200 transition-all active:scale-95 hover:border-rose-500/80 hover:bg-neutral-900/80 hover:text-rose-300 sm:py-2.5 md:flex-none md:px-5 md:text-[11px]"
              >
                {t('header.logout')}
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

          <section className="relative overflow-hidden rounded-xl border border-neutral-800/60 bg-gradient-to-b from-neutral-950/95 via-neutral-950/90 to-black shadow-2xl shadow-neutral-950/50 sm:rounded-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/30 to-transparent" />

            {/* Mobile-optimized tab navigation */}
            <div className="scrollbar-hide overflow-x-auto border-b border-neutral-800/50 bg-neutral-950/50 px-2 pt-2 sm:px-3 sm:pt-3 md:px-5 md:pt-5">
              <div className="inline-flex min-w-full items-center gap-1 rounded-t-xl bg-neutral-900/60 p-1 text-[10px] font-bold uppercase tracking-[0.15em] sm:gap-1.5 sm:text-[11px] md:min-w-0 md:p-1.5 md:text-xs">
                <button
                  onClick={() => setActiveTab("balances")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "balances"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.balances')}
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "history"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.history')}
                </button>
                <button
                  onClick={() => setActiveTab("pnl")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "pnl"
                      ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.pnl')}
                </button>
                <button
                  onClick={() => setActiveTab("buy")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "buy"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.buy')}
                </button>
                <button
                  onClick={() => setActiveTab("sell")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "sell"
                      ? "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.sell')}
                </button>
                <button
                  onClick={() => setActiveTab("verify")}
                  className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 transition-all duration-200 active:scale-95 sm:py-3 md:flex-none md:px-5 md:py-2.5 ${
                    activeTab === "verify"
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : "text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-100"
                  }`}
                >
                  {t('tabs.verify')}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 md:p-6 lg:p-5">
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
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full min-w-[500px] text-xs sm:min-w-0 sm:text-sm">
                        <thead className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 sm:text-[11px]">
                          <tr className="text-left">
                            <th className="py-3 pl-4 font-semibold sm:pl-0">Token</th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              Amount
                            </th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              USD Value
                            </th>
                            <th className="py-3 pr-4 font-semibold">Chain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {balanceRows.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-neutral-900/60 transition-colors active:bg-neutral-900/60 hover:bg-neutral-900/40"
                            >
                              <td className="py-4 pl-4 font-semibold text-neutral-100 sm:pl-0 sm:py-3.5">
                                {row.token}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-neutral-300 sm:pr-4 sm:py-3.5">
                                {row.amount.toFixed(6)}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-sky-300 sm:pr-4 sm:py-3.5">
                                ${row.usd.toFixed(2)}
                              </td>
                              <td className="py-4 pr-4 text-[10px] text-neutral-400 sm:text-xs sm:py-3.5">
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
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="w-full min-w-[600px] text-xs sm:min-w-0 sm:text-sm">
                        <thead className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 sm:text-[11px]">
                          <tr className="text-left">
                            <th className="py-3 pl-4 font-semibold sm:pl-0">Pair</th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              From
                            </th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              To
                            </th>
                            <th className="py-3 pr-2 font-semibold sm:pr-4">Reason</th>
                            <th className="py-3 pr-4 font-semibold">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyRows.map((trow) => (
                            <tr
                              key={trow.id}
                              className="border-b border-neutral-900/60 transition-colors active:bg-neutral-900/60 hover:bg-neutral-900/40"
                            >
                              <td className="py-4 pl-4 font-semibold text-neutral-100 sm:pl-0 sm:py-3.5">
                                {trow.from} → {trow.to}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-neutral-300 sm:pr-4 sm:py-3.5">
                                {trow.fromAmount.toFixed(4)}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-sky-300 sm:pr-4 sm:py-3.5">
                                {trow.toAmount.toFixed(4)}
                              </td>
                              <td className="py-4 pr-2 text-[10px] text-neutral-400 sm:text-xs sm:pr-4 sm:py-3.5">
                                {trow.reason}
                              </td>
                              <td className="py-4 pr-4 text-[10px] text-neutral-500 sm:text-xs sm:py-3.5">
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
                    <div className="mt-5 overflow-x-auto -mx-4 sm:mx-0 sm:mt-6">
                      <table className="w-full min-w-[650px] text-xs sm:min-w-0 sm:text-sm">
                        <thead className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-500 sm:text-[11px]">
                          <tr className="text-left">
                            <th className="py-3 pl-4 font-semibold sm:pl-0">Token</th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              Amount
                            </th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              Avg Buy
                            </th>
                            <th className="py-3 pr-2 text-right font-semibold sm:pr-4">
                              Current Value
                            </th>
                            <th className="py-3 pr-4 text-right font-semibold">
                              PNL
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pnlData.map((p, i) => (
                            <tr
                              key={i}
                              className="border-b border-neutral-900/60 transition-colors active:bg-neutral-900/60 hover:bg-neutral-900/40"
                            >
                              <td className="py-4 pl-4 font-semibold text-neutral-100 sm:pl-0 sm:py-3.5">
                                {p.token}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-neutral-300 sm:pr-4 sm:py-3.5">
                                {p.amount.toFixed(4)}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-neutral-300 sm:pr-4 sm:py-3.5">
                                ${p.avgBuy.toFixed(4)}
                              </td>
                              <td className="py-4 pr-2 text-right font-mono text-sky-300 sm:pr-4 sm:py-3.5">
                                ${p.currentValue.toFixed(2)}
                              </td>
                              <td
                                className={`py-4 pr-4 text-right font-mono font-semibold sm:py-3.5 ${
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

              {activeTab === "verify" && (
                <div className="mx-auto max-w-2xl">
                  <VerifyWalletPanel apiKey={apiKey} />
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Floating Chat Agent - Bottom Right */}
      {isConnected && (
        <>
          {/* Chatbot Panel */}
          {chatbotOpen && (
            <div className="fixed bottom-20 right-4 z-50 h-[500px] w-[380px] sm:bottom-24 sm:right-6 sm:w-[420px]">
              <ChatbotPanel
                openaiKey={openaiKey}
                onSaveKey={saveOpenAIKey}
                balances={balanceRows}
                pnl={pnlData}
                env={env}
                agentName={agentName}
                apiKey={apiKey}
                onExecuteTrade={refreshData}
                onClose={() => setChatbotOpen(false)}
              />
            </div>
          )}

          {/* Chat Agent Button */}
          <button
            onClick={() => setChatbotOpen(!chatbotOpen)}
            className={`group fixed bottom-4 right-4 z-50 flex h-12 items-center gap-2 rounded-full border px-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:px-5 ${
              chatbotOpen
                ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                : "border-neutral-700/50 bg-neutral-900/80 text-neutral-300 hover:border-purple-400/50 hover:bg-neutral-800/90"
            }`}
            aria-label="Toggle Chat Agent"
          >
            <svg
              className={`h-5 w-5 transition-colors sm:h-5 sm:w-5 ${
                chatbotOpen ? "text-purple-400" : "text-neutral-400 group-hover:text-purple-400"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-sm font-semibold">{t('chatbot.chatAgent')}</span>
          </button>
        </>
      )}
    </div>
  );
}
