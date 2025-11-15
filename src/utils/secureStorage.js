// src/utils/secureStorage.js
import CryptoJS from "crypto-js";

// Simple encryption key (in production, this should be env variable)
const SECRET_KEY = "recall-dashboard-secret-key-v1";

/**
 * Encrypt and store data
 */
export function secureSet(key, value) {
  try {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(value),
      SECRET_KEY
    ).toString();
    sessionStorage.setItem(key, encrypted);
    return true;
  } catch (error) {
    console.error("Failed to encrypt data:", error);
    return false;
  }
}

/**
 * Retrieve and decrypt data
 */
export function secureGet(key) {
  try {
    const encrypted = sessionStorage.getItem(key);
    if (!encrypted) return null;

    const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    const data = decrypted.toString(CryptoJS.enc.Utf8);
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to decrypt data:", error);
    return null;
  }
}

/**
 * Remove stored data
 */
export function secureRemove(key) {
  sessionStorage.removeItem(key);
}

/**
 * Clear all secure storage
 */
export function secureClear() {
  sessionStorage.clear();
}

/**
 * Mask API key for display (show first 8 and last 4 chars)
 */
export function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 12) return "***";
  const start = apiKey.substring(0, 8);
  const end = apiKey.substring(apiKey.length - 4);
  return `${start}...${end}`;
}
