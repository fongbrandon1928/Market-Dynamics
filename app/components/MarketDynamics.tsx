'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts'

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

const ETF_TICKERS = ['QQQ', 'DIA', 'SPY', 'SPMD', 'IWM', 'XLF', 'XLE', 'XLK', 'XLC', 'XLP', 'XLU', 'XLV', 'XLI', 'SMH']

// ETF holdings mapping (simplified - in production, fetch from yfinance)
const ETF_HOLDINGS: { [key: string]: string[] } = {
  XLF: ['BRK-B', 'JPM', 'BAC', 'C', 'WFC', 'GS', 'MS', 'BLK', 'CME', 'V', 'MA'],
  XLE: ['XOM', 'CVX', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'HAL', 'COP', 'FANG'],
  XLK: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CSCO', 'AMD', 'INTC', 'QCOM', 'TXN'],
  XLC: ['META', 'GOOGL', 'GOOG', 'NFLX', 'DIS', 'CMCSA', 'VZ', 'T', 'CHTR', 'EA'],
  XLP: ['PG', 'KO', 'PEP', 'WMT', 'COST', 'PM', 'MDLZ', 'CL', 'STZ', 'MNST'],
  XLU: ['NEE', 'DUK', 'SO', 'AEP', 'SRE', 'EXC', 'XEL', 'WEC', 'ES', 'ETR'],
  XLV: ['UNH', 'JNJ', 'ABBV', 'TMO', 'ABT', 'DHR', 'PFE', 'BMY', 'AMGN', 'GILD'],
  XLI: ['RTX', 'GE', 'HON', 'CAT', 'DE', 'EMR', 'ETN', 'ITW', 'PH', 'CMI'],
  SMH: ['NVDA', 'AVGO', 'AMD', 'INTC', 'QCOM', 'TXN', 'AMAT', 'LRCX', 'KLAC', 'MCHP'],
  QQQ: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA', 'AVGO', 'COST'],
  DIA: ['UNH', 'GS', 'HD', 'MSFT', 'CAT', 'AMGN', 'V', 'TRV', 'HON', 'MCD'],
  SPY: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA', 'BRK-B', 'UNH'],
  SPMD: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA', 'BRK-B', 'UNH'],
  IWM: ['AAPL', 'MSFT', 'AMZN', 'NVDA', 'META', 'GOOGL', 'GOOG', 'TSLA', 'BRK-B', 'UNH'],
}

interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

export default function MarketDynamics() {
  const [tickerList, setTickerList] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('2019-12-31')
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [normalizationTicker, setNormalizationTicker] = useState<string>('')
  const [selectedETF, setSelectedETF] = useState<string>('')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // Set default end date to today
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  const handleETFChange = async (etf: string) => {
    setSelectedETF(etf)
    setNormalizationTicker(etf)
    
    // Fetch holdings for the selected ETF
    try {
      const response = await fetch(`/api/etf-holdings?ticker=${etf}`)
      const data = await response.json()
      
      if (data.holdings && data.holdings.length > 0) {
        setTickerList(data.holdings.join(', '))
      } else {
        // Fallback to predefined holdings
        const holdings = ETF_HOLDINGS[etf] || []
        setTickerList(holdings.join(', '))
      }
    } catch (err) {
      // Fallback to predefined holdings
      const holdings = ETF_HOLDINGS[etf] || []
      setTickerList(holdings.join(', '))
    }
  }

  const handleSectorRotation = () => {
    setNormalizationTicker('SPY')
    setTickerList(ETF_TICKERS.join(', '))
    setSelectedETF('')
  }

  const handleGenerate = async () => {
    if (!tickerList || !normalizationTicker || !startDate || !endDate) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError('')

    try {
      const tickers = tickerList.split(',').map(t => t.trim()).filter(t => t)
      
      const response = await fetch('/api/calculate-zscore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers: [...tickers, normalizationTicker],
          normalizationTicker,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to calculate Z-scores')
      }

      const data = await response.json()
      
      // Transform data for chart
      const chartDataPoints: ChartDataPoint[] = []
      
      if (data.zscores && data.dates) {
        data.dates.forEach((date: string, index: number) => {
          const point: ChartDataPoint = { date }
          tickers.forEach((ticker: string) => {
            if (data.zscores[ticker] && data.zscores[ticker][index] !== undefined) {
              // Round z-score to nearest thousandth (3 decimal places)
              const zscore = Math.round(data.zscores[ticker][index] * 1000) / 1000
              point[ticker] = zscore
            }
          })
          chartDataPoints.push(point)
        })
      }
      
      setChartData(chartDataPoints)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error generating chart:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadChartData = () => {
    if (chartData.length === 0) {
      setError('No chart data to download')
      return
    }

    // Convert chart data to CSV
    const headers = ['Date', ...Object.keys(chartData[0]).filter(key => key !== 'date')]
    const rows = chartData.map(point => {
      const values = [point.date]
      headers.slice(1).forEach(header => {
        values.push(point[header]?.toString() || '')
      })
      return values.join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chart-data-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '32px', fontWeight: 'bold' }}>
        Market Dynamics
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Ticker List */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Ticker List</label>
            <textarea
              value={tickerList}
              onChange={(e) => setTickerList(e.target.value)}
              placeholder="Enter tickers separated by commas"
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '10px',
                border: '2px solid #87CEEB',
                borderRadius: '4px',
                backgroundColor: '#E0F6FF',
                fontSize: '14px',
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #90EE90',
                  borderRadius: '4px',
                  backgroundColor: '#F0FFF0',
                  fontSize: '14px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px solid #90EE90',
                  borderRadius: '4px',
                  backgroundColor: '#F0FFF0',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>

          {/* Normalization Ticker */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Normalization Ticker</label>
            <input
              type="text"
              value={normalizationTicker}
              onChange={(e) => setNormalizationTicker(e.target.value)}
              placeholder="e.g., SPY"
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #87CEEB',
                borderRadius: '4px',
                backgroundColor: '#E0F6FF',
                fontSize: '14px',
              }}
            />
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Dropdown */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Select ETF</label>
            <select
              value={selectedETF}
              onChange={(e) => handleETFChange(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                fontSize: '14px',
                appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '16px',
                paddingRight: '35px',
              }}
            >
              <option value="">Select an ETF...</option>
              {ETF_TICKERS.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1E3A8A',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                width: '100%',
              }}
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>

            <button
              onClick={handleSectorRotation}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1E3A8A',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Sector Rotation
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#FEE2E2',
          color: '#DC2626',
          borderRadius: '4px',
          marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      {/* Chart Area */}
      <div style={{
        backgroundColor: '#F0FFF0',
        border: '2px solid #90EE90',
        borderRadius: '8px',
        padding: '20px',
        minHeight: '500px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600' }}>Z-score Chart</h2>
          <button
            onClick={handleDownloadChartData}
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
    </div>
  )
}
