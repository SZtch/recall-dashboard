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

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body ? JSON.parse(options.body) : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Proxy request failed: ${response.status}`);
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
export async function getBalances(apiKey, env) {
  const baseUrl = getBaseUrl(env);

  const resp = await fetchWithProxy(`${baseUrl}/api/agent/balances`, {
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
export async function getHistory(apiKey, env) {
  const baseUrl = getBaseUrl(env);

  const resp = await fetchWithProxy(`${baseUrl}/api/agent/trades`, {
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
export async function getPnlUnrealized(apiKey, env) {
  const baseUrl = getBaseUrl(env);

  try {
    const resp = await fetchWithProxy(`${baseUrl}/api/agent/pnl/unrealized`, {
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
export async function executeTrade(apiKey, env, payload) {
  const baseUrl = getBaseUrl(env);

  // Kita hanya kirim field yang memang dipakai Recall API
  const body = {
    fromToken: payload.fromToken,
    toToken: payload.toToken,
    amount: Number(payload.amount),
    reason: payload.reason || "TRADE",
    // Kalau nanti Recall menambah dukungan chain routing,
    // kamu bisa tambahkan:
    // fromChainKey: payload.fromChainKey,
    // toChainKey: payload.toChainKey,
  };

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
