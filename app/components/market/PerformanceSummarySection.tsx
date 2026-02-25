import { Fragment, useEffect, useState } from 'react'

type PerformanceSummarySectionProps = {
  sectorTickers: string[]
  watchListTickers: string[]
  viewMode: 'absolute' | 'relative'
  onViewModeChange: (value: string) => void
  normalizationTicker: string
}

type SummaryResponse = {
  tickers: Record<string, { returns: Record<string, number>; lastDate: string }>
  periods: string[]
  asOf: string
  source?: 'live'
  compareAsOfDate?: string | null
  comparison?: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }>
}

const formatReturn = (value: number): string => {
  const pct = (value * 100).toFixed(2)
  return `${value >= 0 ? '+' : ''}${pct}%`
}

const normalizeTickers = (tickers: string[]) =>
  Array.from(new Set(tickers.map((ticker) => ticker.trim()).filter(Boolean)))

export default function PerformanceSummarySection({
  sectorTickers,
  watchListTickers,
  viewMode,
  onViewModeChange,
  normalizationTicker,
}: PerformanceSummarySectionProps) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [compareDate, setCompareDate] = useState<string>('')

  const allTickers = normalizeTickers([...sectorTickers, ...watchListTickers])

  const fetchSummary = async () => {
    if (allTickers.length === 0) {
      setSummary(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        tickers: allTickers.join(','),
        viewMode,
        asOfDate: selectedDate,
      })
      if (compareDate) {
        params.set('compareAsOfDate', compareDate)
      }
      if (viewMode === 'relative' && normalizationTicker) {
        params.set('normalizationTicker', normalizationTicker)
      }
      const response = await fetch(`/api/performance-summary?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch performance summary')
      }
      setSummary(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (compareDate && compareDate === selectedDate) {
      setCompareDate('')
    }
  }, [compareDate, selectedDate])

  useEffect(() => {
    fetchSummary()
    const intervalId = window.setInterval(fetchSummary, 24 * 60 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [allTickers.join(','), viewMode, normalizationTicker, selectedDate, compareDate])

  const renderTable = (title: string, tickers: string[]) => {
    if (tickers.length === 0) {
      return (
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          No tickers provided.
        </div>
      )
    }

    const periods = summary?.periods || ['1W', '1M', '1Q']
    const sortedTickers = [...tickers].sort((a, b) => {
      const aValue = summary?.tickers?.[a]?.returns?.['1Q']
      const bValue = summary?.tickers?.[b]?.returns?.['1Q']
      if (aValue === undefined && bValue === undefined) {
        return a.localeCompare(b)
      }
      if (aValue === undefined) {
        return 1
      }
      if (bValue === undefined) {
        return -1
      }
      return bValue - aValue
    })
    return (
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
        <div style={{ fontWeight: '600', marginBottom: '8px' }}>{title}</div>
        {viewMode === 'relative' && normalizationTicker ? (
          <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px' }}>
            Benchmark: {normalizationTicker}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(${periods.length}, 1fr)`, gap: '6px', fontSize: '12px' }}>
          <div style={{ color: '#6B7280' }}>Ticker</div>
          {periods.map((period) => (
            <div key={period} style={{ color: '#6B7280' }}>{period}</div>
          ))}
          {sortedTickers.map((ticker) => {
            const row = summary?.tickers?.[ticker]
            return (
              <Fragment key={ticker}>
                <div style={{ fontWeight: 600 }}>{ticker}</div>
                {periods.map((period) => {
                  const value = row?.returns?.[period]
                  const color = value !== undefined ? (value >= 0 ? '#16A34A' : '#DC2626') : '#6B7280'
                  const delta = summary?.comparison?.[ticker]?.periods?.[period]
                  const deltaColor = delta !== undefined ? (delta >= 0 ? '#16A34A' : '#DC2626') : '#6B7280'
                  return (
                    <div key={`${ticker}-${period}`} style={{ color }}>
                      {value !== undefined ? formatReturn(value) : '—'}
                      {delta !== undefined ? (
                        <div style={{ fontSize: '10px', color: deltaColor }}>
                          Δ {formatReturn(delta)}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: '20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Performance Summary</h2>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            Auto-refreshes daily while open. Summarizes 1W/1M/1Q returns.
            {summary?.asOf ? ` As of ${summary.asOf}.` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'white',
            }}
          />
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
          <input
            type="date"
            value={compareDate}
            onChange={(e) => setCompareDate(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'white',
            }}
          />
          <button
            onClick={fetchSummary}
            disabled={loading}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1E3A8A',
              color: 'white',
              border: 'none',
              borderRadius: '14px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      {error && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {renderTable('Sector Watch (Broad Market)', sectorTickers)}
        {renderTable('Interest Watch List', watchListTickers)}
      </div>
    </div>
  )
}
