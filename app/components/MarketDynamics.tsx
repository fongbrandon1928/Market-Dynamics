'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import ControlsPanel from './market/ControlsPanel'
import ScoreChart from './market/ScoreChart'
import SectorDailyReturnsSection from './market/SectorDailyReturnsSection'
import SectorRelativeSection from './market/SectorRelativeSection'
import SectorRotationSection from './market/SectorRotationSection'
import MarketSummarySection from './market/MarketSummarySection'

const ETF_TICKERS = ['QQQ', 'DIA', 'SPY', 'SPMD', 'IWM', 'XLF', 'XLE', 'XLK', 'XLC', 'XLP', 'XLU', 'XLV', 'XLI', 'SMH']

type MetricOption = 'zscore' | 'modified_zscore' | 'iqr' | 'minmax'

const METRIC_OPTIONS: { label: string; value: MetricOption }[] = [
  { label: 'Z-score', value: 'zscore' },
  { label: 'Modified Z-score (MAD)', value: 'modified_zscore' },
  { label: 'IQR Score', value: 'iqr' },
  { label: 'Min-Max Scaling', value: 'minmax' },
]

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
  const [metric, setMetric] = useState<MetricOption>('zscore')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [sectorReturns, setSectorReturns] = useState<Record<string, { dailyReturn: number; date: string; price: number }>>({})
  const [sectorLoading, setSectorLoading] = useState<boolean>(false)
  const [sectorError, setSectorError] = useState<string>('')
  const [sectorPeriod, setSectorPeriod] = useState<string>('1D')
  const [sectorRelative, setSectorRelative] = useState<Record<string, { value: number; change: number; date: string; baseDate: string }>>({})
  const [sectorRelativeLoading, setSectorRelativeLoading] = useState<boolean>(false)
  const [sectorRelativeError, setSectorRelativeError] = useState<string>('')
  const [marketSummary, setMarketSummary] = useState<string>('')
  const [marketSummaryLoading, setMarketSummaryLoading] = useState<boolean>(false)
  const [marketSummaryError, setMarketSummaryError] = useState<string>('')
  const [sectorRotation, setSectorRotation] = useState<any>(null)
  const [sectorRotationLoading, setSectorRotationLoading] = useState<boolean>(false)
  const [sectorRotationError, setSectorRotationError] = useState<string>('')

  useEffect(() => {
    // Set default end date to today
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  useEffect(() => {
    const fetchSectorReturns = async () => {
      setSectorLoading(true)
      setSectorError('')
      try {
        const results = await Promise.allSettled(
          ETF_TICKERS.map(async (ticker) => {
            const response = await fetch(`/api/sector-return?ticker=${ticker}&period=${sectorPeriod}`)
            const data = await response.json()
            if (!response.ok) {
              throw new Error(data?.error || `Failed to fetch ${ticker}`)
            }
            return {
              ticker,
              dailyReturn: data.dailyReturn as number,
              date: data.date as string,
              price: data.price as number,
            }
          })
        )

        const nextReturns: Record<string, { dailyReturn: number; date: string; price: number }> = {}
        const failures: string[] = []

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            nextReturns[result.value.ticker] = {
              dailyReturn: result.value.dailyReturn,
              date: result.value.date,
              price: result.value.price,
            }
          } else {
            failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
          }
        })

        setSectorReturns(nextReturns)
        if (failures.length > 0 && Object.keys(nextReturns).length === 0) {
          setSectorError(failures[0])
        }
      } catch (err) {
        setSectorError(err instanceof Error ? err.message : 'Failed to fetch sector returns')
      } finally {
        setSectorLoading(false)
      }
    }

    fetchSectorReturns()
  }, [sectorPeriod])

  useEffect(() => {
    const fetchSectorRelative = async () => {
      setSectorRelativeLoading(true)
      setSectorRelativeError('')
      try {
        const results = await Promise.allSettled(
          ETF_TICKERS.map(async (ticker) => {
            const response = await fetch(`/api/sector-relative?ticker=${ticker}&period=${sectorPeriod}`)
            const data = await response.json()
            if (!response.ok) {
              throw new Error(data?.error || `Failed to fetch ${ticker}`)
            }
            return {
              ticker,
              value: data.value as number,
              change: data.change as number,
              date: data.date as string,
              baseDate: data.baseDate as string,
            }
          })
        )

        const nextRelative: Record<string, { value: number; change: number; date: string; baseDate: string }> = {}
        const failures: string[] = []

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            nextRelative[result.value.ticker] = {
              value: result.value.value,
              change: result.value.change,
              date: result.value.date,
              baseDate: result.value.baseDate,
            }
          } else {
            failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
          }
        })

        setSectorRelative(nextRelative)
        if (failures.length > 0 && Object.keys(nextRelative).length === 0) {
          setSectorRelativeError(failures[0])
        }
      } catch (err) {
        setSectorRelativeError(err instanceof Error ? err.message : 'Failed to fetch relative prices')
      } finally {
        setSectorRelativeLoading(false)
      }
    }

    fetchSectorRelative()
  }, [sectorPeriod])

  useEffect(() => {
    const fetchSectorRotation = async () => {
      setSectorRotationLoading(true)
      setSectorRotationError('')
      try {
        const response = await fetch(`/api/sector-rotation?period=${sectorPeriod}&tickers=${ETF_TICKERS.join(',')}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch sector rotation')
        }
        setSectorRotation(data)
      } catch (err) {
        setSectorRotationError(err instanceof Error ? err.message : 'Failed to fetch sector rotation')
      } finally {
        setSectorRotationLoading(false)
      }
    }

    fetchSectorRotation()
  }, [sectorPeriod])

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
          timescale: '2Y',
          metric,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.error || 'Failed to calculate Z-scores'
        const helpMessage = data?.help ? `\n${data.help}` : ''
        throw new Error(`${errorMessage}${helpMessage}`)
      }
      
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

  const handleMarketSummary = async () => {
    setMarketSummaryError('')
    setMarketSummary('')

    setMarketSummaryLoading(true)
    try {
      const sectorSnapshot = ETF_TICKERS.map((ticker) => {
        const data = sectorReturns[ticker]
        if (!data) {
          return `${ticker}: no data`
        }
        return `${ticker}: ${(data.dailyReturn * 100).toFixed(2)}% (${data.date})`
      }).join(', ')

      const response = await fetch('/api/market-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectorPeriod,
          sectorSnapshot,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        const errorValue = data?.error || 'Failed to fetch summary'
        const errorMessage = typeof errorValue === 'string' ? errorValue : JSON.stringify(errorValue)
        throw new Error(errorMessage)
      }

      const rawContent = data?.summary
      const content = typeof rawContent === 'string'
        ? rawContent
        : rawContent
          ? JSON.stringify(rawContent)
          : ''
      if (!content || content.trim().includes('[object Object]')) {
        throw new Error('No summary returned')
      }
      setMarketSummary(content)
    } catch (err) {
      setMarketSummaryError(err instanceof Error ? err.message : 'Failed to fetch summary')
    } finally {
      setMarketSummaryLoading(false)
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

      <ControlsPanel
        tickerList={tickerList}
        onTickerListChange={setTickerList}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        normalizationTicker={normalizationTicker}
        onNormalizationTickerChange={setNormalizationTicker}
        selectedETF={selectedETF}
        onETFChange={handleETFChange}
        etfTickers={ETF_TICKERS}
        onGenerate={handleGenerate}
        onSectorRotation={handleSectorRotation}
        loading={loading}
      />

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

      <ScoreChart
        chartData={chartData}
        metric={metric}
        metricOptions={METRIC_OPTIONS}
        onMetricChange={(value) => setMetric(value as MetricOption)}
        onDownload={handleDownloadChartData}
        loading={loading}
      />

      <SectorDailyReturnsSection
        etfTickers={ETF_TICKERS}
        sectorReturns={sectorReturns}
        sectorLoading={sectorLoading}
        sectorError={sectorError}
        sectorPeriod={sectorPeriod}
        onSectorPeriodChange={setSectorPeriod}
      />

      <SectorRelativeSection
        etfTickers={ETF_TICKERS}
        sectorRelative={sectorRelative}
        sectorRelativeLoading={sectorRelativeLoading}
        sectorRelativeError={sectorRelativeError}
      />

      <SectorRotationSection
        rotationData={sectorRotation}
        sectorLoading={sectorRotationLoading}
        sectorError={sectorRotationError}
        sectorPeriod={sectorPeriod}
      />

      <MarketSummarySection
        marketSummary={marketSummary}
        marketSummaryLoading={marketSummaryLoading}
        marketSummaryError={marketSummaryError}
        onGenerateSummary={handleMarketSummary}
      />
    </div>
  )
}
