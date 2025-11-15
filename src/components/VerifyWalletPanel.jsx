// src/components/VerifyWalletPanel.jsx
import { useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { showSuccess, showError, showLoading, dismissToast } from "../utils/toast";

const RECALL_API_BASE = "https://api.competitions.recall.network";

export default function VerifyWalletPanel({ apiKey }) {
  const [method, setMethod] = useState("wallet"); // 'wallet' or 'privatekey'
  const [privateKey, setPrivateKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedWallet, setVerifiedWallet] = useState(null);

  // Check if already verified
  useState(() => {
    const stored = localStorage.getItem("verifiedWallet");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setVerifiedWallet(data.address);
      } catch (err) {
        console.error("Failed to load verified wallet:", err);
      }
    }
  }, []);

  // Detect if we're in production
  function isProduction() {
    return import.meta.env.PROD && window.location.hostname !== 'localhost';
  }

  // Proxy wrapper for production to bypass CORS
  async function fetchWithProxy(url, options = {}) {
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

      const data = await response.json();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        json: async () => data,
        text: async () => JSON.stringify(data),
      };
    }

    return fetch(url, options);
  }

  // Get nonce from Recall API
  async function getNonce() {
    const response = await fetchWithProxy(`${RECALL_API_BASE}/api/auth/agent/nonce`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get nonce");
    }

    const data = await response.json();
    return data.nonce;
  }

  // Verify wallet with signed message
  async function verifyWallet(message, signature) {
    const response = await fetchWithProxy(`${RECALL_API_BASE}/api/auth/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, signature }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Verification failed");
    }

    const data = await response.json();
    return data;
  }

  // Create verification message
  function createMessage(nonce) {
    const timestamp = new Date().toISOString();
    return `VERIFY_WALLET_OWNERSHIP
Timestamp: ${timestamp}
Domain: ${RECALL_API_BASE}
Purpose: WALLET_VERIFICATION
Nonce: ${nonce}`;
  }

  // Handle wallet connect (MetaMask)
  async function handleWalletConnect() {
    if (!window.ethereum) {
      showError("MetaMask not detected. Please install MetaMask extension.");
      return;
    }

    setLoading(true);
    const toastId = showLoading("Connecting to MetaMask...");

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found");
      }

      dismissToast(toastId);
      const toastId2 = showLoading("Getting nonce from Recall API...");

      // Get nonce
      const nonce = await getNonce();

      dismissToast(toastId2);
      const toastId3 = showLoading("Please sign the message in MetaMask...");

      // Create message
      const message = createMessage(nonce);

      // Request signature
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, accounts[0]],
      });

      dismissToast(toastId3);
      const toastId4 = showLoading("Verifying wallet ownership...");

      // Verify
      const result = await verifyWallet(message, signature);

      dismissToast(toastId4);

      if (result.success) {
        // Save to localStorage
        localStorage.setItem(
          "verifiedWallet",
          JSON.stringify({
            address: result.walletAddress,
            verifiedAt: new Date().toISOString(),
          })
        );

        setVerifiedWallet(result.walletAddress);
        showSuccess(`Wallet verified: ${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}`);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err) {
      dismissToast(toastId);
      console.error("Wallet connect error:", err);
      if (err.code === 4001) {
        showError("User rejected the request");
      } else {
        showError(err.message || "Failed to verify wallet");
      }
    } finally {
      setLoading(false);
    }
  }

  // Handle manual private key
  async function handlePrivateKeyVerify() {
    if (!privateKey || !privateKey.startsWith("0x")) {
      showError("Invalid private key format. Must start with 0x");
      return;
    }

    setLoading(true);
    const toastId = showLoading("Getting nonce from Recall API...");

    try {
      // Get nonce
      const nonce = await getNonce();

      dismissToast(toastId);
      const toastId2 = showLoading("Signing message locally...");

      // Create message
      const message = createMessage(nonce);

      // Sign with private key
      const account = privateKeyToAccount(privateKey);
      const signature = await account.signMessage({ message });

      // Clear private key from memory
      setPrivateKey("");

      dismissToast(toastId2);
      const toastId3 = showLoading("Verifying wallet ownership...");

      // Verify
      const result = await verifyWallet(message, signature);

      dismissToast(toastId3);

      if (result.success) {
        // Save to localStorage
        localStorage.setItem(
          "verifiedWallet",
          JSON.stringify({
            address: result.walletAddress,
            verifiedAt: new Date().toISOString(),
          })
        );

        setVerifiedWallet(result.walletAddress);
        showSuccess(`Wallet verified: ${result.walletAddress.slice(0, 6)}...${result.walletAddress.slice(-4)}`);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err) {
      dismissToast(toastId);
      console.error("Private key verify error:", err);
      showError(err.message || "Failed to verify wallet");
    } finally {
      setLoading(false);
      setPrivateKey(""); // Clear private key
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-neutral-800 bg-neutral-900/95 shadow-2xl backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <h2 className="text-sm font-semibold text-white">Verify Agent Wallet</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {verifiedWallet ? (
          // Already verified
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <div className="mb-2 flex justify-center">
              <svg
                className="h-12 w-12 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="mb-1 text-sm font-semibold text-emerald-400">Wallet Verified!</p>
            <p className="font-mono text-xs text-neutral-400">
              {verifiedWallet.slice(0, 6)}...{verifiedWallet.slice(-4)}
            </p>
            <button
              onClick={() => {
                localStorage.removeItem("verifiedWallet");
                setVerifiedWallet(null);
              }}
              className="mt-4 text-xs text-neutral-500 underline hover:text-neutral-400"
            >
              Verify different wallet
            </button>
          </div>
        ) : (
          // Not verified - show verification form
          <div className="space-y-4">
            <p className="text-xs text-neutral-400">
              Verify your agent's wallet ownership by signing a message.
            </p>

            {/* Method selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300">Choose Method:</label>
              <div className="space-y-2">
                <button
                  onClick={() => setMethod("wallet")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    method === "wallet"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      method === "wallet"
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-neutral-600"
                    }`}
                  >
                    {method === "wallet" && (
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Connect Wallet</p>
                    <p className="text-xs text-neutral-400">Recommended - More secure</p>
                  </div>
                </button>

                <button
                  onClick={() => setMethod("privatekey")}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    method === "privatekey"
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-neutral-700 bg-neutral-800/50 hover:border-neutral-600"
                  }`}
                >
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      method === "privatekey"
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-neutral-600"
                    }`}
                  >
                    {method === "privatekey" && (
                      <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="3" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Manual Private Key</p>
                    <p className="text-xs text-neutral-400">Advanced - Direct input</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Wallet Connect Method */}
            {method === "wallet" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                  <p className="text-xs text-sky-300">
                    🦊 Make sure you have MetaMask or another Web3 wallet extension installed.
                  </p>
                </div>
                <button
                  onClick={handleWalletConnect}
                  disabled={loading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            )}

            {/* Private Key Method */}
            {method === "privatekey" && (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs text-amber-300">
                    ⚠️ Private key is used locally only and never stored or sent anywhere except for signing.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-300">
                    Private Key:
                  </label>
                  <input
                    type="password"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    placeholder="0x..."
                    className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handlePrivateKeyVerify}
                  disabled={loading || !privateKey}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Wallet"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
