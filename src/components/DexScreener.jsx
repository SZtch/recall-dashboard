// src/components/DexScreener.jsx
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  searchPools,
  getTrendingPools,
  getNewPools,
  formatLargeNumber,
  formatPriceChange,
  formatTokenPrice,
  getPriceChangeColor,
} from "../api/dexscreener";
import { showError } from "../utils/toast";

// Chain options matching the dashboard
const CHAIN_OPTIONS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "polygon", label: "Polygon" },
  { id: "optimism", label: "Optimism" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "bsc", label: "BSC" },
  { id: "solana", label: "Solana" },
];

export default function DexScreener({ onQuickTrade }) {
  const { t } = useTranslation();

  // State
  const [mode, setMode] = useState("trending"); // trending, new, search
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [searchQuery, setSearchQuery] = useState("");
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);

  // Fetch data based on mode
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let results = [];

      if (mode === "search" && searchQuery.trim().length >= 2) {
        results = await searchPools(searchQuery);
      } else if (mode === "trending") {
        results = await getTrendingPools(selectedChain);
      } else if (mode === "new") {
        results = await getNewPools(selectedChain);
      }

      setPools(results);
    } catch (error) {
      console.error("Error fetching pools:", error);
      showError("Failed to fetch pool data");
    } finally {
      setLoading(false);
    }
  }, [mode, selectedChain, searchQuery]);

  // Auto-fetch on mode/chain change
  useEffect(() => {
    if (mode === "search" && searchQuery.trim().length < 2) {
      setPools([]);
      return;
    }
    fetchData();
  }, [fetchData, mode, searchQuery]);

  // Debounced search
  useEffect(() => {
    if (mode !== "search") return;

    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        fetchData();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, mode, fetchData]);

  // Handle quick buy
  const handleQuickBuy = (pool) => {
    if (onQuickTrade) {
      onQuickTrade({
        token: pool.baseToken.symbol,
        address: pool.baseToken.address,
        chain: pool.network,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="space-y-4">
        {/* Mode Selector */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode("trending")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === "trending"
                ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            🔥 Trending
          </button>
          <button
            onClick={() => setMode("new")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === "new"
                ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            ✨ New Pools
          </button>
          <button
            onClick={() => setMode("search")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === "search"
                ? "bg-sky-500 text-black shadow-lg shadow-sky-500/30"
                : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            }`}
          >
            🔍 Search
          </button>
        </div>

        {/* Search Input (visible in search mode) */}
        {mode === "search" && (
          <div>
            <input
              type="text"
              placeholder="Search by token name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-neutral-700/60 bg-neutral-900/60 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none transition-all duration-200 focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
            />
            <p className="mt-2 text-xs text-neutral-500">
              Type at least 2 characters to search
            </p>
          </div>
        )}

        {/* Chain Selector (not visible in search mode) */}
        {mode !== "search" && (
          <div>
            <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-300">
              Select Chain
            </label>
            <div className="flex flex-wrap gap-2">
              {CHAIN_OPTIONS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    selectedChain === chain.id
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                      : "bg-neutral-800/30 text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
                  }`}
                >
                  {chain.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-sky-400" />
        </div>
      )}

      {/* Results */}
      {!loading && (
        <div>
          {pools.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800/30">
                  <svg
                    className="h-8 w-8 text-neutral-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-400">
                  {mode === "search"
                    ? "No pools found"
                    : "No pools available"}
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  {mode === "search"
                    ? "Try searching for a different token"
                    : "Try selecting a different chain"}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full min-w-[800px] text-xs sm:min-w-0 sm:text-sm">
                <thead>
                  <tr className="border-b border-neutral-800/50 text-left text-xs uppercase tracking-wider text-neutral-500">
                    <th className="pb-3 pl-4 pr-3 font-semibold sm:pl-0">
                      Token
                    </th>
                    <th className="px-3 pb-3 font-semibold">Price</th>
                    <th className="px-3 pb-3 font-semibold">24h %</th>
                    <th className="px-3 pb-3 font-semibold">Volume</th>
                    <th className="px-3 pb-3 font-semibold">Liquidity</th>
                    <th className="px-3 pb-3 font-semibold">Chain</th>
                    <th className="px-3 pb-3 pr-4 font-semibold sm:pr-0">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/30">
                  {pools.map((pool, idx) => (
                    <tr
                      key={pool.id || idx}
                      className="group transition-colors hover:bg-neutral-800/20"
                    >
                      <td className="py-3 pl-4 pr-3 sm:pl-0">
                        <div>
                          <div className="font-medium text-neutral-100">
                            {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {pool.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-neutral-200">
                        {formatTokenPrice(pool.price)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`font-medium ${getPriceChangeColor(
                            pool.priceChangePercentage.h24
                          )}`}
                        >
                          {formatPriceChange(pool.priceChangePercentage.h24)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-neutral-300">
                        {formatLargeNumber(pool.volume24h)}
                      </td>
                      <td className="px-3 py-3 text-neutral-300">
                        {formatLargeNumber(pool.liquidity)}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          {pool.network}
                        </span>
                      </td>
                      <td className="px-3 py-3 pr-4 sm:pr-0">
                        <button
                          onClick={() => handleQuickBuy(pool)}
                          className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 active:scale-95"
                        >
                          Quick Buy
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pool Count */}
      {!loading && pools.length > 0 && (
        <div className="text-center text-xs text-neutral-500">
          Showing {pools.length} pool{pools.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
