// src/api/crypto.js

/**
 * Fetch crypto price from CoinGecko API
 * Free API, no authentication required
 */

const COINGECKO_API = "https://api.coingecko.com/api/v3";

// Map common symbols to CoinGecko IDs
const SYMBOL_TO_ID = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usd-coin",
  USDT: "tether",
  BNB: "binancecoin",
  ADA: "cardano",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  ARB: "arbitrum",
  OP: "optimism",
};

/**
 * Get coin ID from symbol
 */
function getCoinId(symbol) {
  const upperSymbol = symbol.toUpperCase();
  return SYMBOL_TO_ID[upperSymbol] || symbol.toLowerCase();
}

/**
 * Fetch single crypto price
 */
export async function getCryptoPrice(symbol) {
  try {
    const coinId = getCoinId(symbol);

    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch price for ${symbol}`);
    }

    const data = await response.json();

    if (!data[coinId]) {
      throw new Error(`Coin not found: ${symbol}`);
    }

    const coinData = data[coinId];

    return {
      symbol: symbol.toUpperCase(),
      coinId,
      price: coinData.usd,
      change24h: coinData.usd_24h_change,
      marketCap: coinData.usd_market_cap,
    };
  } catch (error) {
    console.error("Error fetching crypto price:", error);
    throw error;
  }
}

/**
 * Fetch multiple crypto prices
 */
export async function getMultipleCryptoPrices(symbols) {
  try {
    const coinIds = symbols.map(getCoinId).join(",");

    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch crypto prices");
    }

    const data = await response.json();

    return symbols.map((symbol) => {
      const coinId = getCoinId(symbol);
      const coinData = data[coinId];

      if (!coinData) {
        return {
          symbol: symbol.toUpperCase(),
          error: "Not found",
        };
      }

      return {
        symbol: symbol.toUpperCase(),
        coinId,
        price: coinData.usd,
        change24h: coinData.usd_24h_change,
        marketCap: coinData.usd_market_cap,
      };
    });
  } catch (error) {
    console.error("Error fetching multiple crypto prices:", error);
    throw error;
  }
}

/**
 * Format price for display
 */
export function formatPrice(price) {
  if (price >= 1000) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else if (price >= 1) {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else {
    return price.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    });
  }
}

/**
 * Format market cap
 */
export function formatMarketCap(marketCap) {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  } else {
    return `$${marketCap.toLocaleString()}`;
  }
}

/**
 * Format percentage change
 */
export function formatChange(change) {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}
