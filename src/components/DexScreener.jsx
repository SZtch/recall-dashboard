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
    minAge: "", // in hours (minimum pool age)
    maxAge: "", // in hours (maximum pool age)
  });

  // Eligibility requirements
  const ELIGIBILITY_REQUIREMENTS = {
    minVolume: "100000",      // $100,000 USD
    minLiquidity: "100000",   // $100,000 USD
    minFDV: "500000",         // $500,000 USD
    minAge: "720",            // 720 hours (30 days minimum trading history)
  };

  // Apply eligibility filter preset
  const applyEligibilityFilter = useCallback(() => {
    setFilters({
      minVolume: ELIGIBILITY_REQUIREMENTS.minVolume,
      maxVolume: "",
      minLiquidity: ELIGIBILITY_REQUIREMENTS.minLiquidity,
      maxLiquidity: "",
      minFDV: ELIGIBILITY_REQUIREMENTS.minFDV,
      maxFDV: "",
      minAge: ELIGIBILITY_REQUIREMENTS.minAge,
      maxAge: "",
    });
  }, []);

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

  // Handle column sort
  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      // Toggle sort order if clicking same column
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      // New column - default to descending for numbers, ascending for text
      setSortBy(column);
      setSortOrder(column === "token" ? "asc" : "desc");
    }
  }, [sortBy]);

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

    // Min Age filter - pool must be at least this old (for established tokens)
    if (filters.minAge) {
      const minAgeHours = parseFloat(filters.minAge);
      if (!isNaN(minAgeHours)) {
        const minAgeMs = minAgeHours * 60 * 60 * 1000;
        const now = Date.now();
        filtered = filtered.filter(pool => {
          if (!pool.poolCreatedAt) return false; // Exclude if no creation date for min age
          const createdAt = new Date(pool.poolCreatedAt).getTime();
          if (isNaN(createdAt)) return false; // Exclude if invalid date for min age
          const age = now - createdAt;
          return age >= minAgeMs; // Pool must be AT LEAST this old
        });
      }
    }

    // Max Age filter - pool must be younger than this (for new tokens)
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
          return age <= maxAgeMs; // Pool must be AT MOST this old
        });
      }
    }

    // Then, apply sorting
    if (!sortBy) return filtered;

    const sorted = filtered.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case "token":
          // Sort alphabetically by token symbol
          aVal = `${a.baseToken.symbol}/${a.quoteToken.symbol}`.toLowerCase();
          bVal = `${b.baseToken.symbol}/${b.quoteToken.symbol}`.toLowerCase();
          return sortOrder === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);

        case "price":
          aVal = parseFloat(a.price) || 0;
          bVal = parseFloat(b.price) || 0;
          break;

        case "priceChange":
          aVal = parseFloat(a.priceChangePercentage.h24) || 0;
          bVal = parseFloat(b.priceChangePercentage.h24) || 0;
          break;

        case "volume24h":
          aVal = parseFloat(a.volume24h) || 0;
          bVal = parseFloat(b.volume24h) || 0;
          break;

        case "liquidity":
          aVal = parseFloat(a.liquidity) || 0;
          bVal = parseFloat(b.liquidity) || 0;
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
    // Check if text is valid
    if (!text || text === 'undefined' || text === 'null') {
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 right-4 z-50 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg";
      toast.textContent = `${label} not available`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      return;
    }

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
    filters.minFDV, filters.maxFDV, filters.minAge, filters.maxAge
  ].filter(v => v !== "").length;

  // Check if eligibility filter is active
  const isEligibilityFilterActive =
    filters.minVolume === ELIGIBILITY_REQUIREMENTS.minVolume &&
    filters.minLiquidity === ELIGIBILITY_REQUIREMENTS.minLiquidity &&
    filters.minFDV === ELIGIBILITY_REQUIREMENTS.minFDV &&
    filters.minAge === ELIGIBILITY_REQUIREMENTS.minAge &&
    !filters.maxVolume && !filters.maxLiquidity && !filters.maxFDV && !filters.maxAge;

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
            {/* Eligible Filter Button */}
            <button
              onClick={applyEligibilityFilter}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                isEligibilityFilterActive
                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50"
                  : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300"
              }`}
              title="Min: $100k Vol, $100k Liq, $500k FDV, 720h trading history"
            >
              {isEligibilityFilterActive ? "✓ " : ""}Eligible Only
            </button>
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
                    <th
                      className="px-3 pb-3 font-semibold cursor-pointer hover:text-sky-400 transition-colors select-none"
                      onClick={() => handleSort("token")}
                    >
                      <div className="flex items-center gap-1">
                        Token
                        {sortBy === "token" && (
                          <span className="text-sky-400">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 pb-3 font-semibold cursor-pointer hover:text-sky-400 transition-colors select-none"
                      onClick={() => handleSort("price")}
                    >
                      <div className="flex items-center gap-1">
                        Price
                        {sortBy === "price" && (
                          <span className="text-sky-400">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 pb-3 font-semibold cursor-pointer hover:text-sky-400 transition-colors select-none"
                      onClick={() => handleSort("priceChange")}
                    >
                      <div className="flex items-center gap-1">
                        24h %
                        {sortBy === "priceChange" && (
                          <span className="text-sky-400">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 pb-3 font-semibold cursor-pointer hover:text-sky-400 transition-colors select-none"
                      onClick={() => handleSort("volume24h")}
                    >
                      <div className="flex items-center gap-1">
                        Volume
                        {sortBy === "volume24h" && (
                          <span className="text-sky-400">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-3 pb-3 font-semibold cursor-pointer hover:text-sky-400 transition-colors select-none"
                      onClick={() => handleSort("liquidity")}
                    >
                      <div className="flex items-center gap-1">
                        Liquidity
                        {sortBy === "liquidity" && (
                          <span className="text-sky-400">
                            {sortOrder === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
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

            {/* Preset Filters */}
            <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-sm font-bold text-emerald-400">Trading Eligibility</h3>
              </div>
              <p className="mb-3 text-xs text-emerald-300/80">
                Apply minimum requirements for eligible trading tokens:
              </p>
              <ul className="mb-4 space-y-1 text-xs text-emerald-300/70">
                <li>• Minimum 24h Volume: $100,000 USD</li>
                <li>• Minimum Liquidity: $100,000 USD</li>
                <li>• Minimum FDV: $500,000 USD</li>
                <li>• Minimum Trading History: 720 hours (30 days)</li>
              </ul>
              <button
                onClick={() => {
                  applyEligibilityFilter();
                }}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  isEligibilityFilterActive
                    ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500/50"
                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                }`}
              >
                {isEligibilityFilterActive ? "✓ Applied" : "Apply Eligible Tokens Filter"}
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

              {/* Age Filters */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-neutral-300">
                  Pool Age (hours)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      placeholder="Min age (e.g., 720)"
                      value={filters.minAge}
                      onChange={(e) => setFilters(prev => ({ ...prev, minAge: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      For established tokens
                    </p>
                  </div>
                  <div>
                    <input
                      type="number"
                      placeholder="Max age (e.g., 24)"
                      value={filters.maxAge}
                      onChange={(e) => setFilters(prev => ({ ...prev, maxAge: e.target.value }))}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm text-neutral-300 outline-none transition-all focus:border-sky-400/80 focus:bg-neutral-900/90 focus:ring-2 focus:ring-sky-500/20"
                    />
                    <p className="mt-1 text-xs text-neutral-500">
                      For new pools
                    </p>
                  </div>
                </div>
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
                    minAge: "",
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
