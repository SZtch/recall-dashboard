// src/api/backend.js

const BASE_URLS = {
  sandbox: "https://api.sandbox.competitions.recall.network",
  competitions: "https://api.competitions.recall.network",
};

// Detect if we're in production (deployed)
function isProduction() {
  return import.meta.env.PROD && window.location.hostname !== 'localhost';
}

// Helper to build headers
function buildHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// Helper to pick base URL
function getBaseUrl(env) {
  const url = BASE_URLS[env];
  if (!url) {
    throw new Error(`Unknown environment: ${env}`);
  }
  return url;
}

// Proxy wrapper for production to bypass CORS
async function fetchWithProxy(url, options = {}) {
  // In production, use Vercel serverless proxy
  if (isProduction()) {
    const proxyUrl = '/api/proxy';

    // Parse body if it's a JSON string
    let parsedBody;
    if (options.body) {
      try {
        parsedBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        console.error('Failed to parse request body:', e);
        parsedBody = undefined;
      }
    }

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: parsedBody,
      }),
    });

    if (!response.ok) {
      // Try to parse error response, fallback to text if not JSON
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const text = await response.text();
        errorData = { message: `Non-JSON error response: ${text.substring(0, 200)}` };
      }
      throw new Error(errorData.message || errorData.error || `Proxy request failed: ${response.status}`);
    }

    // Return a response-like object
    const data = await response.json();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: async () => data,
      text: async () => JSON.stringify(data),
    };
  }

  // In development, use direct fetch
  return fetch(url, options);
}

/**
 * Get balances from Recall API
 * Used in Dashboard -> Balances tab
 */
export async function getBalances(apiKey, env, competitionId = null) {
  const baseUrl = getBaseUrl(env);

  // competitionId is now REQUIRED by API (always include it)
  const params = new URLSearchParams();
  if (competitionId) {
    params.append('competitionId', competitionId);
  }
  const url = `${baseUrl}/api/agent/balances${params.toString() ? '?' + params.toString() : ''}`;

  const resp = await fetchWithProxy(url, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed to fetch balances (${resp.status}): ${text || resp.statusText}`
    );
  }

  // Shape: { balances: [...] }
  return resp.json();
}

/**
 * Get trade history from Recall API
 * Used in Dashboard -> History tab
 */
export async function getHistory(apiKey, env, competitionId = null) {
  const baseUrl = getBaseUrl(env);

  // competitionId is now REQUIRED by API (always include it)
  const params = new URLSearchParams();
  if (competitionId) {
    params.append('competitionId', competitionId);
  }
  const url = `${baseUrl}/api/agent/trades${params.toString() ? '?' + params.toString() : ''}`;

  const resp = await fetchWithProxy(url, {
    method: "GET",
    headers: buildHeaders(apiKey),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Failed to fetch history (${resp.status}): ${text || resp.statusText}`
    );
  }

  // Shape: { trades: [...] }
  return resp.json();
}

/**
 * Get unrealized PnL data.
 *
 * NOTE:
 * Saat ini API publik Recall belum punya endpoint PnL resmi yang didokumentasikan,
 * jadi di sini kita:
 * 1) Coba panggil endpoint eksperimental /api/agent/pnl/unrealized
 * 2) Kalau gagal, fallback ke [] supaya UI tetap jalan (PnL tab kosong saja)
 */
export async function getPnlUnrealized(apiKey, env, competitionId = null) {
  const baseUrl = getBaseUrl(env);

  try {
    // competitionId is now REQUIRED by API (always include it)
    const params = new URLSearchParams();
    if (competitionId) {
      params.append('competitionId', competitionId);
    }
    const url = `${baseUrl}/api/agent/pnl/unrealized${params.toString() ? '?' + params.toString() : ''}`;

    const resp = await fetchWithProxy(url, {
      method: "GET",
      headers: buildHeaders(apiKey),
    });

    if (!resp.ok) {
      // Kalau endpoint ini belum ada / 404, kita fallback
      console.warn(
        "PNL endpoint not available, returning empty array. Status:",
        resp.status
      );
      return [];
    }

    const data = await resp.json();

    // Sesuaikan ke bentuk yang dipakai Dashboard:
    // expected: [{ token, amount, avgBuy, currentValue, pnl }, ...]
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data.positions)) {
      return data.positions;
    }

    return [];
  } catch (err) {
    console.warn("Error fetching unrealized PnL, returning empty array:", err);
    return [];
  }
}

/**
 * Map frontend chain identifiers to API-expected format
 * API expects: fromChain (svm/evm), fromSpecificChain (mainnet/ethereum/base/etc)
 *
 * Example from API docs:
 * - Solana: { chain: "svm", specificChain: "mainnet" }
 * - Ethereum: { chain: "evm", specificChain: "ethereum" }
 */
function mapChainForAPI(chainId) {
  const mapping = {
    'solana': { chain: 'svm', specificChain: 'mainnet' },
    'ethereum': { chain: 'evm', specificChain: 'ethereum' },
    'base': { chain: 'evm', specificChain: 'base' },
    'polygon': { chain: 'evm', specificChain: 'polygon' },
    'optimism': { chain: 'evm', specificChain: 'optimism' },
    'arbitrum': { chain: 'evm', specificChain: 'arbitrum' },
    'bsc': { chain: 'evm', specificChain: 'bsc' },
  };
  return mapping[chainId] || { chain: 'svm', specificChain: 'mainnet' };
}

/**
 * Execute trade via Recall API
 * Dipakai di BuyPanel dan SellPanel
 *
 * payload shape (Dashboard sekarang):
 * {
 *   fromChainKey,
 *   toChainKey,
 *   fromToken,
 *   toToken,
 *   amount,
 *   reason
 * }
 *
 * Recall endpoint resmi:
 * POST /api/trade/execute
 * body minimal: { fromToken, toToken, amount, reason }
 */
export async function executeTrade(apiKey, env, competitionId = null, payload) {
  const baseUrl = getBaseUrl(env);

  // Map chain identifiers to API format
  const fromChainData = mapChainForAPI(payload.fromChainKey || "solana");
  const toChainData = mapChainForAPI(payload.toChainKey || "solana");

  // Build request body according to API docs
  const body = {
    fromToken: payload.fromToken,
    toToken: payload.toToken,
    amount: String(payload.amount), // API expects string based on example "1.5"
    reason: payload.reason || "TRADE",
    competitionId: competitionId || null,
    // Correct parameter names from API docs
    fromChain: fromChainData.chain,
    fromSpecificChain: fromChainData.specificChain,
    toChain: toChainData.chain,
    toSpecificChain: toChainData.specificChain,
  };

  // Debug logging - VERY VISIBLE
  console.error("==========================================");
  console.error("🔍 TRADE REQUEST DEBUG:");
  console.error("==========================================");
  console.error("Original chains:", payload.fromChainKey, "->", payload.toChainKey);
  console.error("Mapped chains:", fromChainData, "->", toChainData);
  console.table({
    competitionId: body.competitionId,
    fromChain: body.fromChain,
    fromSpecificChain: body.fromSpecificChain,
    toChain: body.toChain,
    toSpecificChain: body.toSpecificChain,
    fromToken: body.fromToken,
    toToken: body.toToken,
    amount: body.amount,
    reason: body.reason,
  });
  console.error("FULL BODY:", JSON.stringify(body, null, 2));
  console.error("==========================================");

  const resp = await fetchWithProxy(`${baseUrl}/api/trade/execute`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(
      `Trade failed (${resp.status}): ${text || resp.statusText}`
    );
  }

  return resp.json();
}
