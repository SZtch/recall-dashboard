import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0];
  const value = data.value;
  const isPositive = value >= 0;

  return (
    <div className="rounded-lg border border-neutral-700/80 bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur-xl">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {data.payload.token}
      </p>
      <p className="flex items-baseline gap-1.5">
        <span className="text-xs text-neutral-500">PNL:</span>
        <span
          className={`text-base font-bold ${
            isPositive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isPositive ? "+" : ""}${value.toFixed(2)}
        </span>
      </p>
      {data.payload.percentage !== undefined && (
        <p className="mt-0.5 text-[10px] text-neutral-500">
          {isPositive ? "↑" : "↓"} {Math.abs(data.payload.percentage).toFixed(2)}%
        </p>
      )}
    </div>
  );
};

export default function PnlChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl border border-dashed border-neutral-800 bg-neutral-950/30">
        <div className="text-center">
          <svg
            className="mx-auto mb-3 h-12 w-12 text-neutral-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm font-medium text-neutral-500">
            No PNL data available yet
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            Execute trades to see your performance
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-neutral-800/60 bg-neutral-950/40 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-200">
            Performance Overview
          </h4>
          <p className="mt-0.5 text-xs text-neutral-500">
            Unrealized profit & loss by token
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-neutral-400">Profit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-neutral-400">Loss</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="positiveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.6} />
              </linearGradient>
              <linearGradient id="negativeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f87171" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#f87171" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            
            <XAxis
              dataKey="token"
              stroke="#525252"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              tickLine={{ stroke: "#404040" }}
              axisLine={{ stroke: "#404040" }}
            />
            
            <YAxis
              stroke="#525252"
              tick={{ fill: "#a3a3a3", fontSize: 11 }}
              tickLine={{ stroke: "#404040" }}
              axisLine={{ stroke: "#404040" }}
              tickFormatter={(value) => `$${value}`}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#171717" }} />
            
            <Bar
              dataKey="pnl"
              radius={[6, 6, 0, 0]}
              maxBarSize={60}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.pnl > 0
                      ? "url(#positiveGradient)"
                      : entry.pnl < 0
                      ? "url(#negativeGradient)"
                      : "#64748b"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-neutral-800/50 pt-4">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Total PNL
          </p>
          <p
            className={`mt-1 text-lg font-bold ${
              data.reduce((sum, item) => sum + item.pnl, 0) >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }`}
          >
            ${data.reduce((sum, item) => sum + item.pnl, 0).toFixed(2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Winners
          </p>
          <p className="mt-1 text-lg font-bold text-emerald-400">
            {data.filter((item) => item.pnl > 0).length}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Losers
          </p>
          <p className="mt-1 text-lg font-bold text-rose-400">
            {data.filter((item) => item.pnl < 0).length}
          </p>
        </div>
      </div>
    </div>
  );
}