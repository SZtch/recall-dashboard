// src/components/TokenDetailModal.jsx
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getPoolOHLCV, formatTokenPrice, formatLargeNumber, formatPriceChange, getPriceChangeColor } from "../api/dexscreener";
import { showError } from "../utils/toast";

// Calculate Moving Average
function calculateMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// Calculate RSI
function calculateRSI(data, period = 14) {
  const result = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      if (i > 0) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      result.push(null);
    } else if (i === period) {
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    } else {
      const change = data[i].close - data[i - 1].close;
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;

      const avgGain = ((result.length > 0 ? gains : 0) * (period - 1) + currentGain) / period;
      const avgLoss = ((result.length > 0 ? losses : 0) * (period - 1) + currentLoss) / period;

      gains = avgGain;
      losses = avgLoss;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);
    }
  }
  return result;
}

export default function TokenDetailModal({ pool, onClose, onBuy, onSell }) {
  const { t } = useTranslation();

  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('minute'); // minute, hour, day
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('candlestick'); // line, candlestick
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [indicators, setIndicators] = useState({
    ma7: false,
    ma25: false,
    volume: true,
    rsi: false,
  });

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

  // Calculate indicators
  const chartDataWithIndicators = useMemo(() => {
    if (chartData.length === 0) return [];

    const ma7 = indicators.ma7 ? calculateMA(chartData, 7) : [];
    const ma25 = indicators.ma25 ? calculateMA(chartData, 25) : [];
    const rsi = indicators.rsi ? calculateRSI(chartData) : [];

    return chartData.map((item, index) => ({
      ...item,
      ma7: ma7[index],
      ma25: ma25[index],
      rsi: rsi[index],
    }));
  }, [chartData, indicators]);

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
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">O:</span>
              <span className="text-neutral-300">{formatTokenPrice(data.open)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">H:</span>
              <span className="text-green-400">{formatTokenPrice(data.high)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">L:</span>
              <span className="text-red-400">{formatTokenPrice(data.low)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-neutral-500">C:</span>
              <span className="font-semibold text-neutral-100">{formatTokenPrice(data.close)}</span>
            </div>
            {data.volume && (
              <div className="flex justify-between gap-4 border-t border-neutral-800 pt-1">
                <span className="text-neutral-500">Vol:</span>
                <span className="text-sky-400">{formatLargeNumber(data.volume)}</span>
              </div>
            )}
            {data.rsi && (
              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">RSI:</span>
                <span className="text-purple-400">{data.rsi.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Candlestick shape
  const Candlestick = (props) => {
    const { x, y, width, height, low, high, open, close } = props;
    const isUp = close > open;
    const color = isUp ? '#10b981' : '#ef4444';
    const ratio = Math.abs(height / (high - low));

    return (
      <g>
        {/* Wick */}
        <line
          x1={x + width / 2}
          y1={y}
          x2={x + width / 2}
          y2={y + height}
          stroke={color}
          strokeWidth={1}
        />
        {/* Body */}
        <rect
          x={x}
          y={isUp ? y + (high - close) * ratio : y + (high - open) * ratio}
          width={width}
          height={Math.abs(open - close) * ratio}
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    );
  };

  const currentPrice = pool.price;
  const priceChange24h = pool.priceChangePercentage.h24;
  const isPositive = priceChange24h >= 0;

  // Timeframe options
  const timeframes = [
    { label: '1M', value: 'minute', aggregate: 1 },
    { label: '5M', value: 'minute', aggregate: 5 },
    { label: '15M', value: 'minute', aggregate: 15 },
    { label: '30M', value: 'minute', aggregate: 30 },
    { label: '1H', value: 'hour', aggregate: 1 },
    { label: '4H', value: 'hour', aggregate: 4 },
    { label: '1D', value: 'day', aggregate: 1 },
  ];

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[60] bg-black"
    : "relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl";

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
        isFullscreen ? '' : 'bg-black/70'
      }`}
      onClick={isFullscreen ? undefined : onClose}
    >
      <div className={containerClass} onClick={(e) => e.stopPropagation()}>
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
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
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
        <div className="grid grid-cols-2 gap-3 border-b border-neutral-800 p-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-neutral-500">24h Volume</p>
            <p className="mt-1 text-base font-semibold text-neutral-100">{formatLargeNumber(pool.volume24h)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Liquidity</p>
            <p className="mt-1 text-base font-semibold text-neutral-100">{formatLargeNumber(pool.liquidity)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">24h Txs</p>
            <p className="mt-1 text-base font-semibold text-neutral-300">
              {pool.txCount24h || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">FDV</p>
            <p className="mt-1 text-base font-semibold text-neutral-300">
              {pool.fdv ? formatLargeNumber(pool.fdv) : 'N/A'}
            </p>
          </div>
        </div>

        {/* Chart Controls */}
        <div className="border-b border-neutral-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Chart Type Toggle */}
            <div className="flex gap-1 rounded-lg bg-neutral-800/50 p-1">
              <button
                onClick={() => setChartType('candlestick')}
                className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                  chartType === 'candlestick'
                    ? 'bg-sky-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                Candles
              </button>
              <button
                onClick={() => setChartType('line')}
                className={`rounded px-3 py-1 text-xs font-semibold transition-all ${
                  chartType === 'line'
                    ? 'bg-sky-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                Line
              </button>
            </div>

            {/* Timeframe Selector */}
            <div className="flex gap-1 rounded-lg bg-neutral-800/50 p-1">
              {timeframes.map((tf) => (
                <button
                  key={tf.label}
                  onClick={() => setTimeframe(tf.value)}
                  className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                    timeframe === tf.value
                      ? 'bg-sky-500 text-black'
                      : 'text-neutral-400 hover:text-neutral-100'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Indicators */}
            <div className="flex gap-1 rounded-lg bg-neutral-800/50 p-1">
              <button
                onClick={() => setIndicators(prev => ({ ...prev, ma7: !prev.ma7 }))}
                className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                  indicators.ma7
                    ? 'bg-yellow-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                MA7
              </button>
              <button
                onClick={() => setIndicators(prev => ({ ...prev, ma25: !prev.ma25 }))}
                className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                  indicators.ma25
                    ? 'bg-orange-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                MA25
              </button>
              <button
                onClick={() => setIndicators(prev => ({ ...prev, volume: !prev.volume }))}
                className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                  indicators.volume
                    ? 'bg-blue-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                Vol
              </button>
              <button
                onClick={() => setIndicators(prev => ({ ...prev, rsi: !prev.rsi }))}
                className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                  indicators.rsi
                    ? 'bg-purple-500 text-black'
                    : 'text-neutral-400 hover:text-neutral-100'
                }`}
              >
                RSI
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="p-4">
          {loading ? (
            <div className={`flex items-center justify-center ${isFullscreen ? 'h-[70vh]' : 'h-64'}`}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-sky-400" />
            </div>
          ) : chartDataWithIndicators.length === 0 ? (
            <div className={`flex items-center justify-center ${isFullscreen ? 'h-[70vh]' : 'h-64'}`}>
              <p className="text-sm text-neutral-500">No chart data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Price Chart */}
              <ResponsiveContainer width="100%" height={isFullscreen ? 500 : 280}>
                <ComposedChart data={chartDataWithIndicators}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatDate}
                    stroke="#737373"
                    style={{ fontSize: '11px' }}
                  />
                  <YAxis
                    yAxisId="price"
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => formatTokenPrice(value)}
                    stroke="#737373"
                    style={{ fontSize: '11px' }}
                    width={70}
                  />
                  {indicators.volume && (
                    <YAxis
                      yAxisId="volume"
                      orientation="right"
                      domain={[0, 'auto']}
                      tickFormatter={(value) => formatLargeNumber(value)}
                      stroke="#737373"
                      style={{ fontSize: '11px' }}
                      width={60}
                    />
                  )}
                  <Tooltip content={<CustomTooltip />} />

                  {/* Volume Bars */}
                  {indicators.volume && (
                    <Bar yAxisId="volume" dataKey="volume" fill="#3b82f6" opacity={0.3} />
                  )}

                  {/* Candlestick or Line */}
                  {chartType === 'line' ? (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="close"
                      stroke={isPositive ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      dot={false}
                    />
                  ) : (
                    <Bar
                      yAxisId="price"
                      dataKey={(data) => [data.low, data.open, data.close, data.high]}
                      shape={(props) => {
                        const { x, y, width, height, payload } = props;
                        if (!payload) return null;
                        const { low, high, open, close } = payload;
                        const isUp = close >= open;
                        const color = isUp ? '#10b981' : '#ef4444';

                        const yScale = height / (high - low || 1);
                        const bodyHeight = Math.abs(close - open) * yScale;
                        const bodyY = isUp ? y + (high - close) * yScale : y + (high - open) * yScale;

                        return (
                          <g>
                            {/* Wick */}
                            <line
                              x1={x + width / 2}
                              y1={y}
                              x2={x + width / 2}
                              y2={y + height}
                              stroke={color}
                              strokeWidth={1}
                            />
                            {/* Body */}
                            <rect
                              x={x + 1}
                              y={bodyY}
                              width={Math.max(width - 2, 1)}
                              height={Math.max(bodyHeight, 1)}
                              fill={color}
                            />
                          </g>
                        );
                      }}
                    />
                  )}

                  {/* Moving Averages */}
                  {indicators.ma7 && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="ma7"
                      stroke="#eab308"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  )}
                  {indicators.ma25 && (
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="ma25"
                      stroke="#f97316"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>

              {/* RSI Indicator */}
              {indicators.rsi && (
                <ResponsiveContainer width="100%" height={120}>
                  <ComposedChart data={chartDataWithIndicators}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={formatDate}
                      stroke="#737373"
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[30, 50, 70]}
                      stroke="#737373"
                      style={{ fontSize: '11px' }}
                      width={40}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="rsi"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={false}
                    />
                    {/* Overbought/Oversold lines */}
                    <Line
                      type="monotone"
                      dataKey={() => 70}
                      stroke="#ef4444"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey={() => 30}
                      stroke="#10b981"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isFullscreen && (
          <div className="sticky bottom-0 border-t border-neutral-800 bg-neutral-950/95 p-4 backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onBuy && onBuy(pool);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Buy {pool.baseToken.symbol}
              </button>
              <button
                onClick={() => {
                  onSell && onSell(pool);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-rose-600 active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                Sell {pool.baseToken.symbol}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
