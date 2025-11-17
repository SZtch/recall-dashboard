// src/components/DexScreener.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
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
import TokenDetailModal from "./TokenDetailModal";

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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [sortBy, setSortBy] = useState(null); // volume24h, liquidity, priceChange
  const [sortOrder, setSortOrder] = useState("desc"); // asc, desc
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("dex-favorites");
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch data based on mode (resets to page 1)
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      setHasMore(true);
      let results = [];

      if (mode === "search" && searchQuery.trim().length >= 2) {
        results = await searchPools(searchQuery);
      } else if (mode === "trending") {
        results = await getTrendingPools(selectedChain, 1);
      } else if (mode === "new") {
        results = await getNewPools(selectedChain, 1);
      }

      setPools(results);

      // If less than 20 results, there's likely no more pages
      if (results.length < 20) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("[DexScreener Component] Error fetching pools:", error);
      setError(error.message || "Failed to fetch pool data");
      showError(error.message || "Failed to fetch pool data");
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedChain, searchQuery]);

  // Load more data (next page)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || mode === "search") return;

    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      let results = [];

      if (mode === "trending") {
        results = await getTrendingPools(selectedChain, nextPage);
      } else if (mode === "new") {
        results = await getNewPools(selectedChain, nextPage);
      }

      if (results.length === 0) {
        setHasMore(false);
      } else {
        setPools(prev => [...prev, ...results]);
        setCurrentPage(nextPage);

        // If less than 20 results, probably no more pages
        if (results.length < 20) {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error("[DexScreener Component] Error loading more:", error);
      showError("Failed to load more pools");
    } finally {
      setLoadingMore(false);
    }
  }, [mode, selectedChain, currentPage, loadingMore, hasMore]);

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

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Only refresh if tab is visible
      if (document.visibilityState === "visible") {
        fetchData();
        setLastRefresh(Date.now());
      }
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchData]);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem("dex-favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Toggle favorite
  const toggleFavorite = useCallback((poolId) => {
    setFavorites(prev => {
      if (prev.includes(poolId)) {
        return prev.filter(id => id !== poolId);
      } else {
        return [...prev, poolId];
      }
    });
  }, []);

  // Sort pools
  const sortedPools = useMemo(() => {
    if (!sortBy) return pools;

    const sorted = [...pools].sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "volume24h":
          aVal = parseFloat(a.volume24h) || 0;
          bVal = parseFloat(b.volume24h) || 0;
          break;
        case "liquidity":
          aVal = parseFloat(a.liquidity) || 0;
          bVal = parseFloat(b.liquidity) || 0;
          break;
        case "priceChange":
          aVal = parseFloat(a.priceChangePercentage.h24) || 0;
          bVal = parseFloat(b.priceChangePercentage.h24) || 0;
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    return sorted;
  }, [pools, sortBy, sortOrder]);

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

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 z-50 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg";
      toast.textContent = `${label} copied!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // ESC to close modal
      if (e.key === "Escape" && selectedPool) {
        setSelectedPool(null);
      }
      // / to focus search
      if (e.key === "/" && mode === "search") {
        e.preventDefault();
        document.querySelector('input[type="text"]')?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedPool, mode]);

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="space-y-4">
        {/* Mode Selector & Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          {/* Auto-refresh & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort Dropdown */}
            <select
              value={sortBy || ""}
              onChange={(e) => setSortBy(e.target.value || null)}
              className="rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-neutral-300 outline-none transition-all hover:bg-neutral-800"
            >
              <option value="">Sort by...</option>
              <option value="volume24h">Volume 24h</option>
              <option value="liquidity">Liquidity</option>
              <option value="priceChange">Price Change</option>
            </select>

            {/* Sort Order Toggle */}
            {sortBy && (
              <button
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="rounded-lg bg-neutral-800/50 px-3 py-2 text-xs text-neutral-300 transition-all hover:bg-neutral-800"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            )}

            {/* Auto-refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                autoRefresh
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                  : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800"
              }`}
              title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            >
              <svg className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {autoRefresh && `${refreshInterval}s`}
            </button>

            {/* Refresh Interval Selector (when auto-refresh is on) */}
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-neutral-300 outline-none"
              >
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            )}
          </div>
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

      {/* Error State */}
      {error && !loading && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-400">Error Loading Data</h3>
              <p className="mt-1 text-xs text-red-300">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/30"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-sky-400" />
          <p className="mt-4 text-sm text-neutral-500">Loading pools...</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
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
                    <th className="pb-3 pl-4 pr-2 font-semibold sm:pl-0 w-8">
                      ⭐
                    </th>
                    <th className="px-3 pb-3 font-semibold">
                      Token
                    </th>
                    <th className="px-3 pb-3 font-semibold">Price</th>
                    <th className="px-3 pb-3 font-semibold">24h %</th>
                    <th className="px-3 pb-3 font-semibold">Volume</th>
                    <th className="px-3 pb-3 font-semibold">Liquidity</th>
                    <th className="px-3 pb-3 font-semibold">Chain</th>
                    <th className="px-3 pb-3 pr-4 font-semibold sm:pr-0">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/30">
                  {sortedPools.map((pool, idx) => {
                    const isFavorite = favorites.includes(pool.id);
                    return (
                    <tr
                      key={pool.id || idx}
                      className="group cursor-pointer transition-colors hover:bg-neutral-800/20"
                      onClick={() => setSelectedPool(pool)}
                    >
                      {/* Favorite */}
                      <td className="py-3 pl-4 pr-2 sm:pl-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(pool.id);
                          }}
                          className="text-lg transition-all hover:scale-110"
                        >
                          {isFavorite ? "⭐" : "☆"}
                        </button>
                      </td>

                      {/* Token */}
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-neutral-100">
                            {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-neutral-500">
                            <span className="truncate max-w-[150px]">{pool.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(pool.baseToken.address, "Address");
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-sky-400"
                              title="Copy address"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-3 font-mono text-neutral-200">
                        {formatTokenPrice(pool.price)}
                      </td>

                      {/* 24h Change */}
                      <td className="px-3 py-3">
                        <span
                          className={`font-medium ${getPriceChangeColor(
                            pool.priceChangePercentage.h24
                          )}`}
                        >
                          {formatPriceChange(pool.priceChangePercentage.h24)}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="px-3 py-3 text-neutral-300">
                        {formatLargeNumber(pool.volume24h)}
                      </td>

                      {/* Liquidity */}
                      <td className="px-3 py-3 text-neutral-300">
                        {formatLargeNumber(pool.liquidity)}
                      </td>

                      {/* Chain */}
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-2 py-1 text-xs font-medium text-neutral-300">
                          {pool.network}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 pr-4 sm:pr-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickBuy(pool);
                            }}
                            className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 active:scale-95"
                          >
                            Buy
                          </button>
                          <a
                            href={`https://dexscreener.com/${pool.network}/${pool.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="opacity-0 group-hover:opacity-100 rounded-lg bg-sky-500/10 px-2 py-1.5 text-xs font-semibold text-sky-400 transition-all hover:bg-sky-500/20"
                            title="View on DexScreener"
                          >
                            🔗
                          </a>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pool Count & Load More */}
      {!loading && sortedPools.length > 0 && (
        <div className="space-y-4">
          <div className="text-center text-xs text-neutral-500">
            Showing {sortedPools.length} pool{sortedPools.length !== 1 ? "s" : ""}
            {favorites.length > 0 && ` • ${favorites.length} favorite${favorites.length !== 1 ? "s" : ""}`}
          </div>

          {/* Load More Button */}
          {hasMore && mode !== "search" && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg bg-sky-500/10 px-6 py-3 text-sm font-semibold text-sky-400 transition-all hover:bg-sky-500/20 hover:text-sky-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                    <span>Loading...</span>
                  </div>
                ) : (
                  `Load More Pools (Page ${currentPage + 1})`
                )}
              </button>
            </div>
          )}

          {/* No More Pools Message */}
          {!hasMore && mode !== "search" && pools.length >= 20 && (
            <div className="text-center text-xs text-neutral-600">
              No more pools to load
            </div>
          )}
        </div>
      )}

      {/* Token Detail Modal */}
      {selectedPool && (
        <TokenDetailModal
          pool={selectedPool}
          onClose={() => setSelectedPool(null)}
          onBuy={(pool) => {
            if (onQuickTrade) {
              onQuickTrade({
                token: pool.baseToken.symbol,
                address: pool.baseToken.address,
                chain: pool.network,
              });
            }
          }}
          onSell={(pool) => {
            // Could add a quick sell handler here too
            if (onQuickTrade) {
              onQuickTrade({
                token: pool.baseToken.symbol,
                address: pool.baseToken.address,
                chain: pool.network,
                action: 'sell',
              });
            }
          }}
        />
      )}
    </div>
  );
}
