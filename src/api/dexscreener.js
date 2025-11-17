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

    console.log('[DexScreener] Searching pools for:', query);

    const response = await fetch(
      `${GECKOTERMINAL_API}/search/pools?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DexScreener] Search failed:', response.status, errorText);
      throw new Error(`Search failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[DexScreener] Search response:', data);

    // GeckoTerminal returns: { data: [...pools] }
    if (!data.data || !Array.isArray(data.data)) {
      console.warn('[DexScreener] No data in response');
      return [];
    }

    // Transform to our format
    const pools = data.data.map(transformPool);
    console.log('[DexScreener] Transformed pools:', pools.length);
    return pools;
  } catch (error) {
    console.error("[DexScreener] Error searching pools:", error);
    throw error;
  }
}

/**
 * Get trending pools for a specific network
 * @param {string} chainKey - Chain key (ethereum, base, etc)
 * @param {number} page - Page number (default 1)
 * @returns {Promise<Array>} Array of trending pools
 */
export async function getTrendingPools(chainKey = "ethereum", page = 1) {
  try {
    const networkId = getNetworkId(chainKey);
    const url = `${GECKOTERMINAL_API}/networks/${networkId}/trending_pools?page=${page}`;

    console.log('[DexScreener] Fetching trending pools:', chainKey, '->', networkId, 'page:', page);
    console.log('[DexScreener] URL:', url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DexScreener] Trending pools failed:', response.status, errorText);
      throw new Error(`Failed to fetch trending pools: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[DexScreener] Trending response:', data);

    if (!data.data || !Array.isArray(data.data)) {
      console.warn('[DexScreener] No trending data');
      return [];
    }

    const pools = data.data.map(transformPool);
    console.log('[DexScreener] Trending pools count:', pools.length);
    return pools;
  } catch (error) {
    console.error("[DexScreener] Error fetching trending pools:", error);
    throw error;
  }
}

/**
 * Get new pools for a specific network
 * @param {string} chainKey - Chain key (ethereum, base, etc)
 * @param {number} page - Page number (default 1)
 * @returns {Promise<Array>} Array of new pools
 */
export async function getNewPools(chainKey = "ethereum", page = 1) {
  try {
    const networkId = getNetworkId(chainKey);
    const url = `${GECKOTERMINAL_API}/networks/${networkId}/new_pools?page=${page}`;

    console.log('[DexScreener] Fetching new pools:', chainKey, '->', networkId, 'page:', page);
    console.log('[DexScreener] URL:', url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DexScreener] New pools failed:', response.status, errorText);
      throw new Error(`Failed to fetch new pools: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[DexScreener] New pools response:', data);

    if (!data.data || !Array.isArray(data.data)) {
      console.warn('[DexScreener] No new pools data');
      return [];
    }

    const pools = data.data.map(transformPool);
    console.log('[DexScreener] New pools count:', pools.length);
    return pools;
  } catch (error) {
    console.error("[DexScreener] Error fetching new pools:", error);
    throw error;
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
 * Get OHLCV (candlestick) data for a pool
 * @param {string} network - Network ID (e.g., 'eth', 'base')
 * @param {string} poolAddress - Pool address
 * @param {string} timeframe - Timeframe: 'day', 'hour', 'minute'
 * @param {number} limit - Number of candles (max 1000)
 * @returns {Promise<Array>} OHLCV data
 */
export async function getPoolOHLCV(network, poolAddress, timeframe = 'hour', limit = 100) {
  try {
    const url = `${GECKOTERMINAL_API}/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`;

    console.log('[DexScreener] Fetching OHLCV:', url);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DexScreener] OHLCV failed:', response.status, errorText);
      throw new Error(`Failed to fetch OHLCV: ${response.status}`);
    }

    const data = await response.json();
    console.log('[DexScreener] OHLCV response:', data);

    if (!data.data || !data.data.attributes || !data.data.attributes.ohlcv_list) {
      return [];
    }

    // Transform OHLCV data to chart format
    return data.data.attributes.ohlcv_list.map(candle => ({
      timestamp: candle[0] * 1000, // Convert to milliseconds
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
    }));
  } catch (error) {
    console.error("[DexScreener] Error fetching OHLCV:", error);
    return [];
  }
}

/**
 * Check if a string is a contract address (hex string starting with 0x)
 */
function isContractAddress(str) {
  if (!str) return false;
  return str.toLowerCase().startsWith('0x') && str.length > 10;
}

/**
 * Parse token symbols from pool name
 * e.g., "WBTC / WETH 0.05%" -> ["WBTC", "WETH"]
 */
function parseSymbolsFromName(name) {
  if (!name) return null;

  // Remove fee tier info (e.g., "0.05%", "0.3%", "1%")
  const cleanName = name.replace(/\s*\d+(\.\d+)?%\s*$/, '').trim();

  // Split by "/" and clean up
  const parts = cleanName.split('/').map(s => s.trim());

  if (parts.length >= 2) {
    const baseSymbol = parts[0];
    const quoteSymbol = parts[1];

    // Don't use if they look like addresses
    if (isContractAddress(baseSymbol) || isContractAddress(quoteSymbol)) {
      return null;
    }

    return [baseSymbol, quoteSymbol];
  }

  return null;
}

/**
 * Transform GeckoTerminal pool data to our format
 */
function transformPool(pool) {
  const attrs = pool.attributes || {};
  const relationships = pool.relationships || {};

  // Log attributes for debugging
  console.log('[DexScreener] Pool attributes:', {
    name: attrs.name,
    transactions: attrs.transactions,
    volume_usd: attrs.volume_usd,
  });

  // Extract base and quote tokens
  const baseToken = relationships.base_token?.data || {};
  const quoteToken = relationships.quote_token?.data || {};

  // Parse symbols from name (PRIMARY SOURCE)
  const symbolsFromName = parseSymbolsFromName(attrs.name);

  // Get symbols with smart fallback
  let baseSymbol = "???";
  let quoteSymbol = "???";

  if (symbolsFromName) {
    // Use parsed symbols from name (e.g., "PEPE / WETH" -> "PEPE", "WETH")
    baseSymbol = symbolsFromName[0];
    quoteSymbol = symbolsFromName[1];
  } else {
    // Fallback: try to extract from token ID, but validate
    const baseFromId = baseToken.id?.split('_').pop()?.toUpperCase();
    const quoteFromId = quoteToken.id?.split('_').pop()?.toUpperCase();

    if (baseFromId && !isContractAddress(baseFromId)) {
      baseSymbol = baseFromId;
    }
    if (quoteFromId && !isContractAddress(quoteFromId)) {
      quoteSymbol = quoteFromId;
    }
  }

  return {
    id: pool.id,
    address: attrs.address,
    name: attrs.name,
    network: extractNetwork(pool.id),

    // Token info with clean symbols
    baseToken: {
      symbol: baseSymbol,
      address: attrs.base_token_address || baseToken.address,
      name: attrs.base_token_name || baseToken.name,
    },
    quoteToken: {
      symbol: quoteSymbol,
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

    // Transaction data - try multiple field names
    txCount24h: attrs.transactions?.h24?.count || attrs.tx_count_h24 || null,
    buys24h: attrs.transactions?.h24?.buys || attrs.buys_h24 || null,
    sells24h: attrs.transactions?.h24?.sells || attrs.sells_h24 || null,

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
  // Convert to number if it's a string
  const numValue = typeof num === 'string' ? parseFloat(num) : num;

  if (!numValue || isNaN(numValue)) return "$0";

  if (numValue >= 1e9) {
    return `$${(numValue / 1e9).toFixed(2)}B`;
  } else if (numValue >= 1e6) {
    return `$${(numValue / 1e6).toFixed(2)}M`;
  } else if (numValue >= 1e3) {
    return `$${(numValue / 1e3).toFixed(2)}K`;
  } else {
    return `$${numValue.toFixed(2)}`;
  }
}

/**
 * Format price change percentage
 */
export function formatPriceChange(change) {
  if (change === null || change === undefined) return "N/A";

  // Convert to number if it's a string
  const numChange = typeof change === 'string' ? parseFloat(change) : change;

  if (isNaN(numChange)) return "N/A";

  const sign = numChange >= 0 ? "+" : "";
  return `${sign}${numChange.toFixed(2)}%`;
}

/**
 * Format token price with smart decimal handling
 */
export function formatTokenPrice(price) {
  // Convert to number if it's a string
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (!numPrice || isNaN(numPrice)) return "$0";

  // For large prices (>= $1000)
  if (numPrice >= 1000) {
    return `$${numPrice.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // For medium prices ($1 - $1000)
  if (numPrice >= 1) {
    return `$${numPrice.toFixed(4)}`;
  }

  // For small prices ($0.01 - $1)
  if (numPrice >= 0.01) {
    return `$${numPrice.toFixed(6)}`;
  }

  // For very small prices (< $0.01)
  // Calculate number of significant digits needed
  const priceStr = numPrice.toString();

  // Handle scientific notation from JS
  if (priceStr.includes('e')) {
    // Parse scientific notation
    const [mantissa, exponent] = priceStr.split('e');
    const exp = parseInt(exponent);

    if (exp < 0) {
      // Negative exponent - very small number
      // Show with enough decimals to display actual value
      const decimals = Math.min(Math.abs(exp) + 2, 12);
      return `$${numPrice.toFixed(decimals)}`;
    }
  }

  // Default: show up to 10 decimals for very small numbers
  // Remove trailing zeros
  let formatted = numPrice.toFixed(10);
  formatted = formatted.replace(/\.?0+$/, '');

  // Ensure we keep at least some decimals
  if (!formatted.includes('.')) {
    formatted += '.00';
  }

  return `$${formatted}`;
}

/**
 * Get color class for price change
 */
export function getPriceChangeColor(change) {
  if (change === null || change === undefined) return "text-gray-400";

  // Convert to number if it's a string
  const numChange = typeof change === 'string' ? parseFloat(change) : change;

  if (isNaN(numChange)) return "text-gray-400";

  return numChange >= 0 ? "text-green-400" : "text-red-400";
}
