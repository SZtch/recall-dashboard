// src/components/TokenDetailModal.jsx
import { useTranslation } from "react-i18next";
import { formatTokenPrice, formatLargeNumber, formatPriceChange, getPriceChangeColor } from "../api/dexscreener";

export default function TokenDetailModal({ pool, onClose, onBuy, onSell }) {
  const { t } = useTranslation();

  if (!pool) return null;

  const currentPrice = pool.price;
  const priceChange24h = pool.priceChangePercentage.h24;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/70"
      onClick={onClose}
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-neutral-100">
                  {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                </h2>
                <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-2 py-0.5 text-xs font-medium text-neutral-400">
                  {pool.network}
                </span>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-100">
                  {formatTokenPrice(currentPrice)}
                </span>
                <span className={`text-base font-semibold ${getPriceChangeColor(priceChange24h)}`}>
                  {formatPriceChange(priceChange24h)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 p-6 md:grid-cols-4">
          <div className="rounded-lg bg-neutral-900/50 p-4">
            <p className="text-xs font-medium text-neutral-500">24h Volume</p>
            <p className="mt-1.5 text-lg font-semibold text-neutral-100">{formatLargeNumber(pool.volume24h)}</p>
          </div>
          <div className="rounded-lg bg-neutral-900/50 p-4">
            <p className="text-xs font-medium text-neutral-500">Liquidity</p>
            <p className="mt-1.5 text-lg font-semibold text-neutral-100">{formatLargeNumber(pool.liquidity)}</p>
          </div>
          <div className="rounded-lg bg-neutral-900/50 p-4">
            <p className="text-xs font-medium text-neutral-500">24h Txs</p>
            <p className="mt-1.5 text-lg font-semibold text-neutral-300">
              {pool.txCount24h || 'N/A'}
            </p>
          </div>
          <div className="rounded-lg bg-neutral-900/50 p-4">
            <p className="text-xs font-medium text-neutral-500">FDV</p>
            <p className="mt-1.5 text-lg font-semibold text-neutral-300">
              {pool.fdv ? formatLargeNumber(pool.fdv) : 'N/A'}
            </p>
          </div>
        </div>

        {/* Token Details */}
        <div className="border-t border-neutral-800 p-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-400">Token Address</span>
              <span className="text-sm font-mono text-neutral-300">
                {pool.baseToken.address.slice(0, 6)}...{pool.baseToken.address.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-neutral-400">Pool Address</span>
              <span className="text-sm font-mono text-neutral-300">
                {pool.address.slice(0, 6)}...{pool.address.slice(-4)}
              </span>
            </div>
            {pool.dexId && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-400">DEX</span>
                <span className="text-sm font-medium text-neutral-300 capitalize">
                  {pool.dexId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 border-t border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                onBuy && onBuy(pool);
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-600 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Buy {pool.baseToken.symbol}
            </button>
            <button
              onClick={() => {
                onSell && onSell(pool);
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-rose-600 active:scale-95"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              Sell {pool.baseToken.symbol}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
