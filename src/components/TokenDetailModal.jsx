// src/components/TokenDetailModal.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPoolOHLCV, formatTokenPrice, formatLargeNumber, formatPriceChange, getPriceChangeColor } from "../api/dexscreener";
import { showError } from "../utils/toast";

export default function TokenDetailModal({ pool, onClose, onBuy, onSell }) {
  const { t } = useTranslation();

  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('hour'); // minute, hour, day
  const [loading, setLoading] = useState(false);

  // Fetch chart data
  useEffect(() => {
    if (!pool) return;

    const fetchChartData = async () => {
      try {
        setLoading(true);
        const data = await getPoolOHLCV(pool.network, pool.address, timeframe, 100);
        setChartData(data);
      } catch (error) {
        console.error("Error fetching chart data:", error);
        showError("Failed to load chart data");
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [pool, timeframe]);

  if (!pool) return null;

  // Format date for tooltip
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    if (timeframe === 'minute') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (timeframe === 'hour') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl">
          <p className="text-xs text-neutral-400">{formatDate(data.timestamp)}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-100">
            {formatTokenPrice(data.close)}
          </p>
          <div className="mt-2 space-y-1 text-xs text-neutral-400">
            <div className="flex justify-between gap-4">
              <span>O:</span>
              <span className="text-neutral-300">{formatTokenPrice(data.open)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>H:</span>
              <span className="text-green-400">{formatTokenPrice(data.high)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>L:</span>
              <span className="text-red-400">{formatTokenPrice(data.low)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const currentPrice = pool.price;
  const priceChange24h = pool.priceChangePercentage.h24;
  const isPositive = priceChange24h >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/95 p-6 backdrop-blur">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-neutral-100">
                  {pool.baseToken.symbol}/{pool.quoteToken.symbol}
                </h2>
                <span className="inline-flex items-center rounded-full bg-neutral-800/50 px-2.5 py-1 text-xs font-medium text-neutral-400">
                  {pool.network}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">{pool.name}</p>

              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-neutral-100">
                  {formatTokenPrice(currentPrice)}
                </span>
                <span className={`text-lg font-semibold ${getPriceChangeColor(priceChange24h)}`}>
                  {formatPriceChange(priceChange24h)}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 border-b border-neutral-800 p-6 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-neutral-500">24h Volume</p>
            <p className="mt-1 text-lg font-semibold text-neutral-100">{formatLargeNumber(pool.volume24h)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Liquidity</p>
            <p className="mt-1 text-lg font-semibold text-neutral-100">{formatLargeNumber(pool.liquidity)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">24h Buys</p>
            <p className="mt-1 text-lg font-semibold text-green-400">{pool.buys24h || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">24h Sells</p>
            <p className="mt-1 text-lg font-semibold text-red-400">{pool.sells24h || 'N/A'}</p>
          </div>
        </div>

        {/* Chart */}
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-neutral-100">Price Chart</h3>

            {/* Timeframe Selector */}
            <div className="flex gap-1 rounded-lg bg-neutral-800/50 p-1">
              {[
                { label: '15M', value: 'minute' },
                { label: '1H', value: 'hour' },
                { label: '1D', value: 'day' },
              ].map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                    timeframe === tf.value
                      ? 'bg-sky-500 text-black'
                      : 'text-neutral-400 hover:text-neutral-100'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex h-80 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-sky-400" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-80 items-center justify-center">
              <p className="text-sm text-neutral-500">No chart data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatDate}
                  stroke="#737373"
                  style={{ fontSize: '12px' }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => formatTokenPrice(value)}
                  stroke="#737373"
                  style={{ fontSize: '12px' }}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={isPositive ? '#4ade80' : '#f87171'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Price Changes */}
        <div className="border-t border-neutral-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-neutral-100">Price Changes</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-neutral-500">5 Minutes</p>
              <p className={`mt-1 text-lg font-semibold ${getPriceChangeColor(pool.priceChangePercentage.m5)}`}>
                {formatPriceChange(pool.priceChangePercentage.m5)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">1 Hour</p>
              <p className={`mt-1 text-lg font-semibold ${getPriceChangeColor(pool.priceChangePercentage.h1)}`}>
                {formatPriceChange(pool.priceChangePercentage.h1)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">6 Hours</p>
              <p className={`mt-1 text-lg font-semibold ${getPriceChangeColor(pool.priceChangePercentage.h6)}`}>
                {formatPriceChange(pool.priceChangePercentage.h6)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">24 Hours</p>
              <p className={`mt-1 text-lg font-semibold ${getPriceChangeColor(pool.priceChangePercentage.h24)}`}>
                {formatPriceChange(pool.priceChangePercentage.h24)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 border-t border-neutral-800 bg-neutral-950/95 p-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                onBuy && onBuy(pool);
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-white transition-all hover:bg-emerald-600 active:scale-95"
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
              className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-6 py-3 font-semibold text-white transition-all hover:bg-rose-600 active:scale-95"
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
