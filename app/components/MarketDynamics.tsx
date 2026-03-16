'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import ControlsPanel from './market/ControlsPanel'
import ScoreChart from './market/ScoreChart'
import SectorDailyReturnsSection from './market/SectorDailyReturnsSection'
import MarketSummarySection from './market/MarketSummarySection'
import PerformanceSummarySection from './market/PerformanceSummarySection'

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
  [key: string]: string | number | Record<string, number>
  prices: Record<string, number>
}

type ChartViewMode = 'absolute' | 'relative'

export default function MarketDynamics() {
  const [tickerList, setTickerList] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('2019-12-31')
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [normalizationTicker, setNormalizationTicker] = useState<string>('')
  const [selectedETF, setSelectedETF] = useState<string>('')
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('absolute')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [sectorReturns, setSectorReturns] = useState<Record<string, { dailyReturn: number; date: string; price: number }>>({})
  const [sectorLoading, setSectorLoading] = useState<boolean>(false)
  const [sectorError, setSectorError] = useState<string>('')
  const [sectorPeriod, setSectorPeriod] = useState<string>('1D')
  const [marketSummary, setMarketSummary] = useState<string>('')
  const [marketSummaryLoading, setMarketSummaryLoading] = useState<boolean>(false)
  const [marketSummaryError, setMarketSummaryError] = useState<string>('')
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    // Set default end date to today
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const updateLayout = () => setIsMobile(mediaQuery.matches)
    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
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
    const intervalId = window.setInterval(fetchSectorReturns, 60000)
    return () => window.clearInterval(intervalId)
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
    if (!tickerList || !startDate || !endDate) {
      setError('Please fill in all required fields')
      return
    }
    if (chartViewMode === 'relative' && !normalizationTicker) {
      setError('Please provide a normalization ticker for relative view')
      return
    }

    setLoading(true)
    setError('')

    try {
      const tickers = tickerList.split(',').map(t => t.trim()).filter(t => t)
      const uniqueTickers = Array.from(new Set(tickers))
      
      const response = await fetch('/api/calculate-returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers: uniqueTickers,
          normalizationTicker: normalizationTicker || null,
          startDate,
          endDate,
          viewMode: chartViewMode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data?.error || 'Failed to calculate cumulative returns'
        const helpMessage = data?.help ? `\n${data.help}` : ''
        throw new Error(`${errorMessage}${helpMessage}`)
      }
      
      // Transform data for chart
      const chartDataPoints: ChartDataPoint[] = []
      
      if (data.returns && data.dates) {
        data.dates.forEach((date: string, index: number) => {
          const point: ChartDataPoint = { date, prices: {} }
          tickers.forEach((ticker: string) => {
            if (data.returns[ticker] && data.returns[ticker][index] !== undefined) {
              const cumulativeReturn = Math.round(data.returns[ticker][index] * 1000) / 1000
              point[ticker] = cumulativeReturn
            }
            if (data.prices?.[ticker] && data.prices[ticker][index] !== undefined) {
              point.prices[ticker] = data.prices[ticker][index]
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

      const rotationSnapshot = ''

      const response = await fetch('/api/market-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectorPeriod,
          sectorSnapshot,
          rotationSnapshot,
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
    <div style={{ padding: isMobile ? '12px' : '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', fontSize: isMobile ? '26px' : '32px', fontWeight: 'bold' }}>
        Market Dynamics
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '320px minmax(0, 1fr)', gap: '20px', alignItems: 'stretch', marginBottom: '20px' }}>
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

        <ScoreChart
          chartData={chartData}
          viewMode={chartViewMode}
          onViewModeChange={(value) => setChartViewMode(value as ChartViewMode)}
          onDownload={handleDownloadChartData}
          loading={loading}
        />
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

      <PerformanceSummarySection
        sectorTickers={ETF_TICKERS}
        watchListTickers={tickerList.split(',').map((ticker) => ticker.trim()).filter(Boolean)}
        viewMode={chartViewMode}
        onViewModeChange={(value) => setChartViewMode(value as ChartViewMode)}
        normalizationTicker={normalizationTicker}
      />

      <SectorDailyReturnsSection
        etfTickers={ETF_TICKERS}
        sectorReturns={sectorReturns}
        sectorLoading={sectorLoading}
        sectorError={sectorError}
        sectorPeriod={sectorPeriod}
        onSectorPeriodChange={setSectorPeriod}
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
