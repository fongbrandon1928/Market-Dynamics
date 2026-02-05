import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts'

type ChartDataPoint = {
  date: string
  [key: string]: string | number
}

type MetricOption = {
  label: string
  value: string
}

type ScoreChartProps = {
  chartData: ChartDataPoint[]
  metric: string
  metricOptions: MetricOption[]
  onMetricChange: (value: string) => void
  onDownload: () => void
  loading: boolean
}

// Helper function to calculate rating score (moved outside component for tooltip)
const cumProb = (z: number): number => {
  // Cumulative probability using standard normal distribution approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp(-z * z / 2)
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - prob : prob
}

const ratingScore = (zscore: number): number => {
  return 100 * cumProb(zscore)
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
          const zscore = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value) || 0
          const rating = ratingScore(zscore)
          return (
            <p key={index} style={{
              margin: '4px 0',
              color: entry.color,
              fontSize: '13px',
            }}>
              {entry.name}: {zscore.toFixed(3)} (Rating: {rating.toFixed(0)})
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
  metric,
  metricOptions,
  onMetricChange,
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
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Score Chart</h2>
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'white',
            }}
          >
            {metricOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
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
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Brush dataKey="date" height={20} stroke="#1E3A8A" />
            {Object.keys(chartData[0] || {})
              .filter(key => key !== 'date')
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
