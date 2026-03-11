import { Fragment, ReactNode, useEffect, useState } from 'react'

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
  normalizationTicker?: string | null
  source?: 'live'
  compareAsOfDate?: string | null
  analysis?: {
    summary: string[]
    trendFlags: Array<{ ticker: string; signal: string; details: string }>
    rotationSignals: string[]
  }
  comparison?: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }>
}

const formatReturn = (value: number): string => {
  const pct = (value * 100).toFixed(2)
  return `${value >= 0 ? '+' : ''}${pct}%`
}

const normalizeTickers = (tickers: string[]) =>
  Array.from(new Set(tickers.map((ticker) => ticker.trim()).filter(Boolean)))

const formatTrendFlagDetails = (details: string): string => {
  const normalized = details.replace(/\s+/g, ' ').trim()
  const sentences = normalized.split(/(?<=\.)\s+/)
  const lines: string[] = []

  sentences.forEach((sentence) => {
    const trimmed = sentence.trim()
    if (!trimmed) {
      return
    }

    const vsMatch = trimmed.match(/^(Vs [^:]+:)\s*(.+)$/i)
    if (vsMatch) {
      const [, label, values] = vsMatch
      lines.push(label)
      values
        .replace(/\.$/, '')
        .split(/,\s*/)
        .filter(Boolean)
        .forEach((part) => lines.push(`  ${part.trim()}`))
      return
    }

    if (/^1W\b/.test(trimmed) && trimmed.includes(',')) {
      trimmed
        .replace(/\.$/, '')
        .split(/,\s*/)
        .filter(Boolean)
        .forEach((part) => lines.push(part.trim()))
      return
    }

    lines.push(trimmed)
  })

  return lines.join('\n')
}

const formatMomentumDeterioratingCompact = (details: string): string => {
  const normalized = details.replace(/\s+/g, ' ').trim()
  const sentences = normalized.split(/(?<=\.)\s+/)
  const returnsSentence = sentences.find((sentence) => /^1W\b/.test(sentence.trim())) || ''
  const fadeSentence = sentences.find((sentence) => /^Short-term fade:/i.test(sentence.trim())) || ''
  const vsSentence = sentences.find((sentence) => /^Vs [^:]+:/i.test(sentence.trim())) || ''

  const returnsLine = returnsSentence.replace(/\.$/, '').split(/,\s*/).join(' | ')
  const fadeLine = fadeSentence.replace(/\.$/, '')
  const compactVs = vsSentence
    .replace(/\.$/, '')
    .replace(/^Vs ([^:]+):\s*/i, 'Vs $1 ')
    .split(/,\s*/)
    .join(', ')

  return [returnsLine, [fadeLine, compactVs].filter(Boolean).join(' | ')].filter(Boolean).join('\n')
}

const renderTrendMetricsWithColor = (text: string): ReactNode[] => {
  const metricPattern = /([+-]\d+(?:\.\d+)?(?:%|pp))/g
  return text.split(metricPattern).map((part, index) => {
    if (/^[+-]\d+(?:\.\d+)?(?:%|pp)$/.test(part)) {
      const isPositive = part.startsWith('+')
      return (
        <span key={`metric-${index}`} style={{ color: isPositive ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
          {part}
        </span>
      )
    }
    return <span key={`text-${index}`}>{part}</span>
  })
}

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
      if (normalizationTicker) {
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

  const trendSignals = [
    'Consistent Outperformance',
    'Consistent Underperformance',
    'Momentum Improving',
    'Momentum Deteriorating',
  ] as const

  const groupedTrendFlags = trendSignals.map((signal) => ({
    signal,
    items: (summary?.analysis?.trendFlags || []).filter((flag) => flag.signal === signal),
  }))
  const trendBenchmark = (summary?.normalizationTicker || normalizationTicker || 'SPY').toUpperCase()

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
      {summary?.analysis && (
        <div style={{ marginBottom: '12px', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Automated Market Summary</div>
          <div style={{ fontSize: '12px', color: '#111827' }}>
            {summary.analysis.summary.map((line, index) => (
              <div key={`summary-${index}`}>- {line}</div>
            ))}
          </div>
          <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Trend Flags
            <span
              title={
                'Possible outputs:\n' +
                `- Consistent Outperformance: beats ${trendBenchmark} across:\n` +
                '  1W\n' +
                '  1M\n' +
                '  1Q\n' +
                `- Consistent Underperformance: lags ${trendBenchmark} across:\n` +
                '  1W\n' +
                '  1M\n' +
                '  1Q\n' +
                '- Momentum Improving:\n' +
                '  1W\n' +
                '  1M\n' +
                '  1Q (1W > 1M > 1Q)\n' +
                '- Momentum Deteriorating:\n' +
                '  1W\n' +
                '  1M\n' +
                '  1Q (1W < 1M < 1Q)'
              }
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '999px',
                border: '1px solid #9CA3AF',
                color: '#4B5563',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'help',
                userSelect: 'none',
              }}
            >
              ?
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#111827' }}>
            {summary.analysis.trendFlags.length === 0 ? (
              <div>- No major trend flags detected.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', gap: '8px', marginTop: '6px' }}>
                {groupedTrendFlags.map((group) => {
                  const isPositive = group.signal.includes('Outperformance') || group.signal.includes('Improving')
                  const isNegative = group.signal.includes('Underperformance') || group.signal.includes('Deteriorating')
                  const headerBg = isPositive ? '#DCFCE7' : isNegative ? '#FEE2E2' : '#E5E7EB'
                  const headerColor = isPositive ? '#166534' : isNegative ? '#991B1B' : '#374151'
                  const cardBorder = isPositive ? '#86EFAC' : isNegative ? '#FCA5A5' : '#D1D5DB'
                  return (
                    <div key={group.signal} style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px', backgroundColor: '#FFFFFF' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', backgroundColor: headerBg, color: headerColor, display: 'inline-block', marginBottom: '8px' }}>
                        {group.signal}
                      </div>
                      {group.items.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>No tickers</div>
                      ) : (
                        group.items.map((flag, index) => {
                          const isMomentumDeteriorating = group.signal === 'Momentum Deteriorating'
                          const stackedDetails = isMomentumDeteriorating
                            ? formatMomentumDeterioratingCompact(flag.details)
                            : formatTrendFlagDetails(flag.details)
                          return (
                            <div key={`flag-${group.signal}-${flag.ticker}-${index}`} style={{ marginBottom: isMomentumDeteriorating ? '6px' : '8px' }}>
                              <div style={{ fontWeight: 700, fontSize: '12px' }}>{flag.ticker}</div>
                              <div style={{ fontSize: '12px', color: '#374151' }}>
                                {stackedDetails.split('\n').map((line, lineIndex) => (
                                  <div key={`line-${lineIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
                                    {renderTrendMetricsWithColor(line)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '12px' }}>Sector Rotation Discovery</div>
          <div style={{ fontSize: '12px', color: '#111827' }}>
            {summary.analysis.rotationSignals.map((signal, index) => (
              <div key={`rotation-${index}`}>- {signal}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {renderTable('Sector Watch (Broad Market)', sectorTickers)}
        {renderTable('Interest Watch List', watchListTickers)}
      </div>
    </div>
  )
}
