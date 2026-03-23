'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts'

type ChartDataPoint = {
  date: string
  [key: string]: string | number | Record<string, number>
  prices: Record<string, number>
}

type ScoreChartProps = {
  chartData: ChartDataPoint[]
  viewMode: 'absolute' | 'relative'
  onViewModeChange: (value: string) => void
  onDownload: () => void
  loading: boolean
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          backgroundColor: 'var(--md-surface)',
          border: '1px solid var(--md-border-strong)',
          borderRadius: '4px',
          padding: '10px',
          boxShadow: 'var(--md-shadow-tooltip)',
          color: 'var(--md-text)',
        }}
      >
        <p style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>Date: {label}</p>
        {payload.map((entry: any, index: number) => {
          const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value) || 0
          const price = entry?.payload?.prices?.[entry.name]
          return (
            <p
              key={index}
              style={{
                margin: '4px 0',
                color: entry.color,
                fontSize: '13px',
              }}
            >
              {entry.name}: {value >= 0 ? '+' : ''}
              {(value * 100).toFixed(2)}%
              {typeof price === 'number' && price !== 0 ? ` ($${price.toFixed(2)})` : ''}
            </p>
          )
        })}
      </div>
    )
  }
  return null
}

const tickStyle = { fontSize: 12, fill: 'var(--md-chart-axis)' }

export default function ScoreChart({
  chartData,
  viewMode,
  onViewModeChange,
  onDownload,
  loading,
}: ScoreChartProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--md-chart-surface)',
        border: '2px solid var(--md-chart-border)',
        borderRadius: '8px',
        padding: '20px',
        minHeight: '500px',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', margin: 0, color: 'var(--md-text)' }}>
            Cumulative Return Chart
          </h2>
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--md-border-strong)',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'var(--md-input-bg)',
              color: 'var(--md-text)',
            }}
          >
            <option value="absolute">Pure Cumulative Return</option>
            <option value="relative">Normalized vs Benchmark</option>
          </select>
        </div>
        <button
          onClick={onDownload}
          disabled={chartData.length === 0}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--md-primary)',
            color: 'var(--md-on-primary)',
            border: 'none',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: chartData.length === 0 ? 'not-allowed' : 'pointer',
            opacity: chartData.length === 0 ? 0.5 : 1,
            maxWidth: '100%',
          }}
        >
          Download Chart Data
        </button>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--md-chart-grid)" />
            <XAxis
              dataKey="date"
              tick={tickStyle}
              stroke="var(--md-chart-grid)"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={tickStyle} stroke="var(--md-chart-grid)" />
            <ReferenceLine y={0} stroke="var(--md-chart-zero)" strokeWidth={2} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: 'var(--md-text)' }} />
            <Brush dataKey="date" height={20} stroke="var(--md-primary)" />
            {Object.keys(chartData[0] || {})
              .filter((key) => key !== 'date' && key !== 'prices')
              .map((ticker, index) => {
                const seriesColors = [
                  '#8884d8',
                  '#82ca9d',
                  '#ffc658',
                  '#ff7300',
                  '#22d3ee',
                  '#e879f9',
                  '#2dd4bf',
                  '#fbbf24',
                ]
                return (
                  <Area
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={seriesColors[index % seriesColors.length]}
                    strokeWidth={1.5}
                    fill={seriesColors[index % seriesColors.length]}
                    fillOpacity={0.12}
                    dot={false}
                    isAnimationActive={false}
                  />
                )
              })}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '400px',
            color: 'var(--md-empty-text)',
            fontSize: '16px',
          }}
        >
          {loading ? 'Loading chart data...' : 'Click Generate to create cumulative return chart'}
        </div>
      )}
    </div>
  )
}
