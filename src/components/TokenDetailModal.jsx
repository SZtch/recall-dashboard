// src/components/TokenDetailModal.jsx
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle
} from 'lightweight-charts';
import { getPoolOHLCV, formatTokenPrice, formatLargeNumber, formatPriceChange, getPriceChangeColor } from "../api/dexscreener";
import { showError } from "../utils/toast";

// Aggregate candles (e.g., convert 1M to 5M, 1H to 4H)
function aggregateCandles(candles, multiplier) {
  if (multiplier === 1) return candles;

  const aggregated = [];
  for (let i = 0; i < candles.length; i += multiplier) {
    const group = candles.slice(i, i + multiplier);
    if (group.length === 0) continue;

    const open = group[0].open;
    const high = Math.max(...group.map(c => c.high));
    const low = Math.min(...group.map(c => c.low));
    const close = group[group.length - 1].close;
    const volume = group.reduce((sum, c) => sum + (c.volume || 0), 0);

    // Validate aggregated candle
    if (
      !isNaN(open) && open > 0 &&
      !isNaN(high) && high > 0 &&
      !isNaN(low) && low > 0 &&
      !isNaN(close) && close > 0 &&
      high >= open && high >= close &&
      low <= open && low <= close
    ) {
      aggregated.push({
        time: group[0].time, // Use timestamp of first candle in group
        open,
        high,
        low,
        close,
        volume,
      });
    }
  }
  return aggregated;
}

// Calculate Moving Average
function calculateMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, value: null });
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, item) => acc + item.close, 0);
      result.push({ time: data[i].time, value: sum / period });
    }
  }
  return result.filter(item => item.value !== null);
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
    } else if (i === period) {
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i].time, value: rsi });
    } else {
      const change = data[i].close - data[i - 1].close;
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;

      const avgGain = (gains * (period - 1) + currentGain) / period;
      const avgLoss = (losses * (period - 1) + currentLoss) / period;

      gains = avgGain;
      losses = avgLoss;

      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push({ time: data[i].time, value: rsi });
    }
  }
  return result;
}

export default function TokenDetailModal({ pool, onClose, onBuy, onSell }) {
  const { t } = useTranslation();

  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState('1H'); // Use label instead of API value
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('candlestick');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [indicators, setIndicators] = useState({
    ma7: false,
    ma25: false,
    volume: true,
    rsi: false,
  });

  // Map timeframe labels to GeckoTerminal API values
  // API only supports: 'minute', 'hour', 'day'
  // For other timeframes, we aggregate base data
  const timeframeToAPI = {
    '1M': { value: 'minute', limit: 100, multiplier: 1 },
    '5M': { value: 'minute', limit: 500, multiplier: 5 },   // Fetch 500 minutes, aggregate to 100 5M candles
    '15M': { value: 'minute', limit: 1000, multiplier: 15 }, // Fetch 1000 minutes, aggregate to ~66 15M candles
    '30M': { value: 'minute', limit: 1000, multiplier: 30 }, // Fetch 1000 minutes, aggregate to ~33 30M candles
    '1H': { value: 'hour', limit: 100, multiplier: 1 },
    '4H': { value: 'hour', limit: 400, multiplier: 4 },     // Fetch 400 hours, aggregate to 100 4H candles
    '1D': { value: 'day', limit: 100, multiplier: 1 },
  };

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ma7SeriesRef = useRef(null);
  const ma25SeriesRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const rsiChartRef = useRef(null);
  const rsiSeriesRef = useRef(null);

  // Fetch chart data
  useEffect(() => {
    if (!pool) return;

    const fetchChartData = async () => {
      try {
        setLoading(true);
        const apiConfig = timeframeToAPI[timeframe];

        // Fetch base data from API
        const rawData = await getPoolOHLCV(
          pool.network,
          pool.address,
          apiConfig.value,
          apiConfig.limit
        );
        console.log(`Fetched ${rawData.length} raw ${apiConfig.value} candles for ${timeframe}`);

        // Aggregate if needed (e.g., 1M -> 5M, 1H -> 4H)
        let processedData = rawData;
        if (apiConfig.multiplier > 1) {
          // Convert to format expected by aggregateCandles
          const candlesForAggregation = rawData.map(item => ({
            time: Math.floor(new Date(item.timestamp).getTime() / 1000),
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume || 0),
          }));

          const aggregated = aggregateCandles(candlesForAggregation, apiConfig.multiplier);

          // Convert back to API format
          processedData = aggregated.map(candle => ({
            timestamp: candle.time * 1000,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));

          console.log(`Aggregated to ${processedData.length} ${timeframe} candles`);
        }

        setChartData(processedData);
      } catch (error) {
        console.error("Error fetching chart data:", error);
        showError("Failed to load chart data");
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [pool, timeframe]); // timeframeToAPI is stable, no need in deps

  // Initialize and update chart
  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    // Clear existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create new chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#404040',
      },
      timeScale: {
        borderColor: '#404040',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: isFullscreen ? 500 : 280,
    });

    chartRef.current = chart;

    // Prepare data with Unix timestamps and validate
    const formattedData = chartData
      .map(item => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume || 0),
      }))
      .filter(item => {
        // Filter out invalid data points
        if (
          isNaN(item.time) ||
          isNaN(item.open) || item.open === null || item.open <= 0 ||
          isNaN(item.high) || item.high === null || item.high <= 0 ||
          isNaN(item.low) || item.low === null || item.low <= 0 ||
          isNaN(item.close) || item.close === null || item.close <= 0
        ) {
          return false;
        }

        // Validate OHLC relationships (critical for candlestick charts)
        // High must be >= both open and close
        // Low must be <= both open and close
        if (
          item.high < item.open ||
          item.high < item.close ||
          item.low > item.open ||
          item.low > item.close
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => a.time - b.time); // Sort chronologically

    // Skip chart creation if no valid data
    if (formattedData.length === 0) {
      console.warn('No valid chart data available');
      return;
    }

    console.log(`Chart data: ${formattedData.length} valid candles`, formattedData.slice(0, 3));

    // Add candlestick or line series (v5 API)
    if (chartType === 'candlestick') {
      try {
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#ef4444',
          borderUpColor: '#10b981',
          borderDownColor: '#ef4444',
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
        });
        candleSeries.setData(formattedData);
        candleSeriesRef.current = candleSeries;
      } catch (error) {
        console.error('Error adding candlestick series:', error);
        console.log('Failed data sample:', formattedData.slice(0, 5));
        return;
      }
    } else {
      const lineSeries = chart.addSeries(LineSeries, {
        color: pool.priceChangePercentage.h24 >= 0 ? '#10b981' : '#ef4444',
        lineWidth: 2,
      });
      const lineData = formattedData
        .map(d => ({ time: d.time, value: d.close }))
        .filter(d => !isNaN(d.value) && d.value !== null && d.value > 0);
      lineSeries.setData(lineData);
      candleSeriesRef.current = lineSeries;
    }

    // Add volume histogram (v5 API)
    if (indicators.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#3b82f6',
        priceFormat: {
          type: 'volume',
        },
        priceScaleId: '',
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });
      const volumeData = formattedData
        .map(d => ({
          time: d.time,
          value: d.volume || 0,
          color: d.close >= d.open ? '#10b98150' : '#ef444450',
        }))
        .filter(d => !isNaN(d.value) && d.value >= 0);
      volumeSeries.setData(volumeData);
      volumeSeriesRef.current = volumeSeries;
    }

    // Add MA7 (v5 API)
    if (indicators.ma7) {
      const ma7Data = calculateMA(formattedData, 7).filter(
        d => d.value !== null && !isNaN(d.value) && d.value > 0
      );
      if (ma7Data.length > 0) {
        const ma7Series = chart.addSeries(LineSeries, {
          color: '#eab308',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        ma7Series.setData(ma7Data);
        ma7SeriesRef.current = ma7Series;
      }
    }

    // Add MA25 (v5 API)
    if (indicators.ma25) {
      const ma25Data = calculateMA(formattedData, 25).filter(
        d => d.value !== null && !isNaN(d.value) && d.value > 0
      );
      if (ma25Data.length > 0) {
        const ma25Series = chart.addSeries(LineSeries, {
          color: '#f97316',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
        });
        ma25Series.setData(ma25Data);
        ma25SeriesRef.current = ma25Series;
      }
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [chartData, chartType, indicators.volume, indicators.ma7, indicators.ma25, isFullscreen, pool]);

  // RSI Chart
  useEffect(() => {
    if (!indicators.rsi || !rsiContainerRef.current || chartData.length === 0) {
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      return;
    }

    // Clear existing RSI chart
    if (rsiChartRef.current) {
      rsiChartRef.current.remove();
      rsiChartRef.current = null;
    }

    // Create RSI chart
    const rsiChart = createChart(rsiContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      rightPriceScale: {
        borderColor: '#404040',
      },
      timeScale: {
        borderColor: '#404040',
        visible: false,
      },
      width: rsiContainerRef.current.clientWidth,
      height: 120,
    });

    rsiChartRef.current = rsiChart;

    // Format data and validate
    const formattedData = chartData
      .map(item => ({
        time: Math.floor(new Date(item.timestamp).getTime() / 1000),
        close: parseFloat(item.close),
      }))
      .filter(item => !isNaN(item.close) && item.close > 0);

    // Skip if no valid data
    if (formattedData.length < 15) {
      console.warn('Not enough data to calculate RSI');
      return;
    }

    // Calculate RSI
    const rsiData = calculateRSI(formattedData, 14).filter(
      d => d.value !== null && !isNaN(d.value) && d.value >= 0 && d.value <= 100
    );

    if (rsiData.length === 0) {
      console.warn('No valid RSI data');
      return;
    }

    // Add RSI line (v5 API)
    const rsiSeries = rsiChart.addSeries(LineSeries, {
      color: '#a855f7',
      lineWidth: 2,
    });
    rsiSeries.setData(rsiData);
    rsiSeriesRef.current = rsiSeries;

    // Add overbought line (70) (v5 API)
    const overboughtSeries = rsiChart.addSeries(LineSeries, {
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    overboughtSeries.setData(rsiData.map(d => ({ time: d.time, value: 70 })));

    // Add oversold line (30) (v5 API)
    const oversoldSeries = rsiChart.addSeries(LineSeries, {
      color: '#10b981',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
    });
    oversoldSeries.setData(rsiData.map(d => ({ time: d.time, value: 30 })));

    rsiChart.timeScale().fitContent();

    // Sync time scale with main chart
    if (chartRef.current) {
      chartRef.current.timeScale().subscribeVisibleTimeRangeChange(() => {
        const timeRange = chartRef.current.timeScale().getVisibleRange();
        if (timeRange && rsiChartRef.current) {
          rsiChartRef.current.timeScale().setVisibleRange(timeRange);
        }
      });
    }

    // Handle resize
    const handleResize = () => {
      if (rsiContainerRef.current && rsiChartRef.current) {
        rsiChartRef.current.applyOptions({
          width: rsiContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
    };
  }, [indicators.rsi, chartData]);

  if (!pool) return null;

  const currentPrice = pool.price;
  const priceChange24h = pool.priceChangePercentage.h24;

  // Timeframe options (now using labels as values)
  const timeframes = ['1M', '5M', '15M', '30M', '1H', '4H', '1D'];

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[60] bg-black overflow-y-auto"
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
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`rounded px-2 py-1 text-xs font-semibold transition-all ${
                    timeframe === tf
                      ? 'bg-sky-500 text-black'
                      : 'text-neutral-400 hover:text-neutral-100'
                  }`}
                >
                  {tf}
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
          ) : chartData.length === 0 ? (
            <div className={`flex items-center justify-center ${isFullscreen ? 'h-[70vh]' : 'h-64'}`}>
              <p className="text-sm text-neutral-500">No chart data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Main Chart */}
              <div ref={chartContainerRef} className="rounded-lg border border-neutral-800/50" />

              {/* RSI Chart */}
              {indicators.rsi && (
                <div ref={rsiContainerRef} className="rounded-lg border border-neutral-800/50" />
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
