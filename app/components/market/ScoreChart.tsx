import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, ReferenceLine } from 'recharts'

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

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        padding: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <p style={{ marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
          Date: {label}
        </p>
        {payload.map((entry: any, index: number) => {
          const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value) || 0
          const price = entry?.payload?.prices?.[entry.name]
          return (
            <p key={index} style={{
              margin: '4px 0',
              color: entry.color,
              fontSize: '13px',
            }}>
              {entry.name}: {value >= 0 ? '+' : ''}{(value * 100).toFixed(2)}%
              {typeof price === 'number' && price !== 0 ? ` ($${price.toFixed(2)})` : ''}
            </p>
          )
        })}
      </div>
    )
  }
  return null
}

export default function ScoreChart({
  chartData,
  viewMode,
  onViewModeChange,
  onDownload,
  loading,
}: ScoreChartProps) {
  return (
    <div style={{
      backgroundColor: '#F0FFF0',
      border: '2px solid #90EE90',
      borderRadius: '8px',
      padding: '20px',
      minHeight: '500px',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Cumulative Return Chart</h2>
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'white',
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
            backgroundColor: '#1E3A8A',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: chartData.length === 0 ? 'not-allowed' : 'pointer',
            opacity: chartData.length === 0 ? 0.5 : 1,
          }}
        >
          Download Chart Data
        </button>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="#111827" strokeWidth={2} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Brush dataKey="date" height={20} stroke="#1E3A8A" />
            {Object.keys(chartData[0] || {})
              .filter(key => key !== 'date' && key !== 'prices')
              .map((ticker, index) => {
                const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff', '#00ffff', '#ffff00']
                return (
                  <Area
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={colors[index % colors.length]}
                    strokeWidth={1.5}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.12}
                    dot={false}
                    isAnimationActive={false}
                  />
                )
              })}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '400px',
          color: '#666',
          fontSize: '16px',
        }}>
          {loading ? 'Loading chart data...' : 'Click Generate to create Z-score chart'}
        </div>
      )}
    </div>
  )
}
