// src/components/DexScreener.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  searchPools,
  getTrendingPools,
  formatLargeNumber,
  formatPriceChange,
  formatTokenPrice,
  getPriceChangeColor,
} from "../api/dexscreener";
import { showError } from "../utils/toast";
import TokenDetailModal from "./TokenDetailModal";

// Chain options
const CHAIN_OPTIONS = [
  { id: "eth", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "polygon_pos", label: "Polygon" },
  { id: "optimism", label: "Optimism" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "bsc", label: "BSC" },
  { id: "solana", label: "Solana" },
];

export default function DexScreener({ onQuickTrade }) {
  const { t } = useTranslation();

  // State
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [selectedChain, setSelectedChain] = useState("eth");
  const [sortBy, setSortBy] = useState(null); // volume24h, liquidity, priceChange
  const [sortOrder, setSortOrder] = useState("desc"); // asc, desc
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("dex-favorites");
    return saved ? JSON.parse(saved) : [];
  });

  // Filters
  const [filters, setFilters] = useState({
    minVolume: "",
    maxVolume: "",
    minLiquidity: "",
    maxLiquidity: "",
    minFDV: "",
    maxFDV: "",
    maxAge: "", // in hours
  });

  // Fetch data based on selected chain
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await getTrendingPools(selectedChain, 1);
      setPools(results);
    } catch (error) {
      console.error("[DexScreener Component] Error fetching pools:", error);
      setError(error.message || "Failed to fetch pool data");
      showError(error.message || "Failed to fetch pool data");
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [selectedChain]);

  // Auto-fetch when chain changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Filter and sort pools
  const sortedPools = useMemo(() => {
    // First, apply filters
    let filtered = [...pools];

    // Volume filter - only filter if value exists
    if (filters.minVolume) {
      const minVol = parseFloat(filters.minVolume);
      filtered = filtered.filter(pool => {
        const vol = parseFloat(pool.volume24h);
        return !isNaN(vol) && vol >= minVol;
      });
    }
    if (filters.maxVolume) {
      const maxVol = parseFloat(filters.maxVolume);
      filtered = filtered.filter(pool => {
        const vol = parseFloat(pool.volume24h);
        return !isNaN(vol) && vol <= maxVol;
      });
    }

    // Liquidity filter - only filter if value exists
    if (filters.minLiquidity) {
      const minLiq = parseFloat(filters.minLiquidity);
      filtered = filtered.filter(pool => {
        const liq = parseFloat(pool.liquidity);
        return !isNaN(liq) && liq >= minLiq;
      });
    }
    if (filters.maxLiquidity) {
      const maxLiq = parseFloat(filters.maxLiquidity);
      filtered = filtered.filter(pool => {
        const liq = parseFloat(pool.liquidity);
        return !isNaN(liq) && liq <= maxLiq;
      });
    }

    // FDV filter - only filter if value exists
    if (filters.minFDV) {
      const minFdv = parseFloat(filters.minFDV);
      filtered = filtered.filter(pool => {
        const fdv = parseFloat(pool.fdv);
        return !isNaN(fdv) && fdv >= minFdv;
      });
    }
    if (filters.maxFDV) {
      const maxFdv = parseFloat(filters.maxFDV);
      filtered = filtered.filter(pool => {
        const fdv = parseFloat(pool.fdv);
        return !isNaN(fdv) && fdv <= maxFdv;
      });
    }

    // Age filter (max hours) - only filter pools with valid creation date
    if (filters.maxAge) {
      const maxAgeHours = parseFloat(filters.maxAge);
      if (!isNaN(maxAgeHours)) {
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();
        filtered = filtered.filter(pool => {
          if (!pool.poolCreatedAt) return true; // Include if no creation date
          const createdAt = new Date(pool.poolCreatedAt).getTime();
          if (isNaN(createdAt)) return true; // Include if invalid date
          const age = now - createdAt;
          return age <= maxAgeMs;
        });
      }
    }

    // Then, apply sorting
    if (!sortBy) return filtered;

    const sorted = filtered.sort((a, b) => {
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
  }, [pools, sortBy, sortOrder, filters]);

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
      // ESC to close modal or filter modal
      if (e.key === "Escape") {
        if (selectedPool) {
          setSelectedPool(null);
        } else if (showFilterModal) {
          setShowFilterModal(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectedPool, showFilterModal]);

  const activeFilterCount = [
    filters.minVolume, filters.maxVolume,
    filters.minLiquidity, filters.maxLiquidity,
    filters.minFDV, filters.maxFDV, filters.maxAge
  ].filter(v => v !== "").length;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="space-y-4">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-neutral-100">Trending Pools</h2>
            <span className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-400">
              {selectedChain === "eth" ? "Ethereum" :
               selectedChain === "base" ? "Base" :
               selectedChain === "polygon_pos" ? "Polygon" :
               selectedChain === "optimism" ? "Optimism" :
               selectedChain === "arbitrum" ? "Arbitrum" :
               selectedChain === "bsc" ? "BSC" :
               selectedChain === "solana" ? "Solana" : "All Chains"}
            </span>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Button */}
            <button
              onClick={() => setShowFilterModal(true)}
              className="relative rounded-lg bg-neutral-800/50 px-4 py-3 text-sm font-semibold text-neutral-300 transition-all hover:bg-neutral-800 hover:text-neutral-100"
            >
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-black">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            </button>

            {/* Chain Selector */}
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-3 text-sm text-neutral-300 outline-none transition-all hover:bg-neutral-800"
            >
              {CHAIN_OPTIONS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.label}
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy || ""}
              onChange={(e) => setSortBy(e.target.value || null)}
              className="rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-3 text-sm text-neutral-300 outline-none transition-all hover:bg-neutral-800"
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
                className="rounded-lg bg-neutral-800/50 px-3 py-3 text-sm text-neutral-300 transition-all hover:bg-neutral-800"
                title={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? "↑" : "↓"}
              </button>
            )}
          </div>
        </div>
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
                  No pools found
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Try selecting a different chain or adjust your filters
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

      {/* Pool Count */}
      {!loading && sortedPools.length > 0 && (
        <div className="text-center text-xs text-neutral-500">
          Showing {sortedPools.length} pool{sortedPools.length !== 1 ? "s" : ""}
          {favorites.length > 0 && ` • ${favorites.length} favorite${favorites.length !== 1 ? "s" : ""}`}
          {activeFilterCount > 0 && ` • ${activeFilterCount} filter${activeFilterCount !== 1 ? "s" : ""} active`}
        </div>
      )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="absolute inset-0"
            onClick={() => setShowFilterModal(false)}
          />
          <div className="relative w-full max-w-2xl rounded-xl border border-neutral-800/50 bg-neutral-900 p-6 shadow-2xl">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-100">Advanced Filters</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Filter pools by volume, liquidity, FDV, and age
                </p>
              </div>
              <button
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter Form */}
            <div className="space-y-5">
              {/* Volume Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-300">
                  Volume 24h (USD)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Minimum"
                    value={filters.minVolume}
                    onChange={(e) => setFilters(prev => ({ ...prev, minVolume: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="number"
                    placeholder="Maximum"
                    value={filters.maxVolume}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxVolume: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* Liquidity Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-300">
                  Liquidity (USD)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Minimum"
                    value={filters.minLiquidity}
                    onChange={(e) => setFilters(prev => ({ ...prev, minLiquidity: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="number"
                    placeholder="Maximum"
                    value={filters.maxLiquidity}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxLiquidity: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* FDV Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-300">
                  Fully Diluted Valuation (USD)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Minimum"
                    value={filters.minFDV}
                    onChange={(e) => setFilters(prev => ({ ...prev, minFDV: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                  <input
                    type="number"
                    placeholder="Maximum"
                    value={filters.maxFDV}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxFDV: e.target.value }))}
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              {/* Age Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-300">
                  Max Pool Age (hours)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 24 for pools created in last 24 hours"
                  value={filters.maxAge}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxAge: e.target.value }))}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                />
                <p className="text-xs text-neutral-500">
                  Leave empty to show pools of any age
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-800/50 pt-6">
              <button
                onClick={() => {
                  setFilters({
                    minVolume: "",
                    maxVolume: "",
                    minLiquidity: "",
                    maxLiquidity: "",
                    minFDV: "",
                    maxFDV: "",
                    maxAge: "",
                  });
                }}
                className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/20"
              >
                Clear All Filters
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-semibold text-black transition-all hover:bg-sky-400 active:scale-95"
              >
                Apply Filters
              </button>
            </div>
          </div>
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
