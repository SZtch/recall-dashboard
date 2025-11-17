// src/api/dexscreener.js
// GeckoTerminal API integration for DEX screener functionality

const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2";

// Map dashboard chain keys to GeckoTerminal network IDs
const CHAIN_TO_NETWORK = {
  ethereum: "eth",
  base: "base",
  polygon: "polygon_pos",
  optimism: "optimism",
  arbitrum: "arbitrum",
  bsc: "bsc",
  solana: "solana",
};

// Reverse mapping for display
const NETWORK_TO_CHAIN = Object.fromEntries(
  Object.entries(CHAIN_TO_NETWORK).map(([k, v]) => [v, k])
);

/**
 * Get network ID from chain key
 */
function getNetworkId(chainKey) {
  return CHAIN_TO_NETWORK[chainKey] || chainKey;
}

/**
 * Search for pools across all networks
 * @param {string} query - Token symbol, name, or address
 * @returns {Promise<Array>} Array of pool results
 */
export async function searchPools(query) {
  try {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const response = await fetch(
      `${GECKOTERMINAL_API}/search/pools?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();

    // GeckoTerminal returns: { data: [...pools] }
    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    // Transform to our format
    return data.data.map(transformPool);
  } catch (error) {
    console.error("Error searching pools:", error);
    return [];
  }
}

/**
 * Get trending pools for a specific network
 * @param {string} chainKey - Chain key (ethereum, base, etc)
 * @returns {Promise<Array>} Array of trending pools
 */
export async function getTrendingPools(chainKey = "ethereum") {
  try {
    const networkId = getNetworkId(chainKey);

    const response = await fetch(
      `${GECKOTERMINAL_API}/networks/${networkId}/trending_pools`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trending pools: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map(transformPool);
  } catch (error) {
    console.error("Error fetching trending pools:", error);
    return [];
  }
}

/**
 * Get new pools for a specific network
 * @param {string} chainKey - Chain key (ethereum, base, etc)
 * @returns {Promise<Array>} Array of new pools
 */
export async function getNewPools(chainKey = "ethereum") {
  try {
    const networkId = getNetworkId(chainKey);

    const response = await fetch(
      `${GECKOTERMINAL_API}/networks/${networkId}/new_pools`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch new pools: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data)) {
      return [];
    }

    return data.data.map(transformPool);
  } catch (error) {
    console.error("Error fetching new pools:", error);
    return [];
  }
}

/**
 * Get specific pool by network and address
 * @param {string} chainKey - Chain key
 * @param {string} poolAddress - Pool address
 * @returns {Promise<Object>} Pool details
 */
export async function getPoolDetails(chainKey, poolAddress) {
  try {
    const networkId = getNetworkId(chainKey);

    const response = await fetch(
      `${GECKOTERMINAL_API}/networks/${networkId}/pools/${poolAddress}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch pool details: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data) {
      return null;
    }

    return transformPool(data.data);
  } catch (error) {
    console.error("Error fetching pool details:", error);
    return null;
  }
}

/**
 * Transform GeckoTerminal pool data to our format
 */
function transformPool(pool) {
  const attrs = pool.attributes || {};
  const relationships = pool.relationships || {};

  // Extract base and quote tokens
  const baseToken = relationships.base_token?.data || {};
  const quoteToken = relationships.quote_token?.data || {};

  return {
    id: pool.id,
    address: attrs.address,
    name: attrs.name,
    network: extractNetwork(pool.id),

    // Token info
    baseToken: {
      symbol: attrs.base_token_symbol || baseToken.symbol || "???",
      address: attrs.base_token_address || baseToken.address,
      name: attrs.base_token_name || baseToken.name,
    },
    quoteToken: {
      symbol: attrs.quote_token_symbol || quoteToken.symbol || "???",
      address: attrs.quote_token_address || quoteToken.address,
      name: attrs.quote_token_name || quoteToken.name,
    },

    // Price data
    price: attrs.base_token_price_usd,
    priceChangePercentage: {
      h24: attrs.price_change_percentage?.h24,
      h6: attrs.price_change_percentage?.h6,
      h1: attrs.price_change_percentage?.h1,
      m5: attrs.price_change_percentage?.m5,
    },

    // Volume and liquidity
    volume24h: attrs.volume_usd?.h24,
    liquidity: attrs.reserve_in_usd,
    fdv: attrs.fdv_usd,
    marketCap: attrs.market_cap_usd,

    // Transaction data
    txCount24h: attrs.transactions?.h24,
    buys24h: attrs.transactions?.h24_buys,
    sells24h: attrs.transactions?.h24_sells,

    // Pool metadata
    poolCreatedAt: attrs.pool_created_at,
    dexId: relationships.dex?.data?.id,

    // Raw data for advanced usage
    raw: pool,
  };
}

/**
 * Extract network from pool ID (format: network_address)
 */
function extractNetwork(poolId) {
  if (!poolId) return "unknown";
  const parts = poolId.split("_");
  return parts[0] || "unknown";
}

/**
 * Format large numbers (volume, liquidity, etc)
 */
export function formatLargeNumber(num) {
  if (!num) return "$0";

  if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`;
  } else {
    return `$${num.toFixed(2)}`;
  }
}

/**
 * Format price change percentage
 */
export function formatPriceChange(change) {
  if (change === null || change === undefined) return "N/A";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * Format token price
 */
export function formatTokenPrice(price) {
  if (!price) return "$0";

  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(4)}`;
  } else if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  } else {
    return `$${price.toExponential(2)}`;
  }
}

/**
 * Get color class for price change
 */
export function getPriceChangeColor(change) {
  if (change === null || change === undefined) return "text-gray-400";
  return change >= 0 ? "text-green-400" : "text-red-400";
}
