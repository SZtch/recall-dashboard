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

  // Kita hanya kirim field yang memang dipakai Recall API
  const body = {
    fromToken: payload.fromToken,
    toToken: payload.toToken,
    amount: Number(payload.amount),
    reason: payload.reason || "TRADE",
    // competitionId is now REQUIRED by API (always include it)
    competitionId: competitionId || null,
    // Add chain keys for same-blockchain trading (default to solana if not provided)
    fromChainKey: payload.fromChainKey || "solana",
    toChainKey: payload.toChainKey || "solana",
  };

  // Debug logging
  console.log("🔍 Trade Request:", {
    competitionId: body.competitionId,
    payload_fromChainKey: payload.fromChainKey,
    payload_toChainKey: payload.toChainKey,
    body_fromChainKey: body.fromChainKey,
    body_toChainKey: body.toChainKey,
    fromToken: body.fromToken,
    toToken: body.toToken,
    amount: body.amount,
  });

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
