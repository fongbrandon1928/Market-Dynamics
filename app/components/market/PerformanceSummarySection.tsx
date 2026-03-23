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
  analysis?: {
    marketSummaryByPeriod?: Array<{
      period: '1M' | '1Q' | '6M' | '1Y'
      leaders: Array<{ ticker: string; value: number }>
      laggards: Array<{ ticker: string; value: number }>
      benchmarkPct: number | null
    }>
    trendFlagsCount?: number
    rotationSignalsCount?: number
    trendFlags: Array<{ ticker: string; signal: string; details: string }>
    rotationSignals: string[]
  }
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
      const periodParts = values
        .replace(/\.$/, '')
        .split(/,\s*/)
        .filter(Boolean)
        .map((part) => part.trim())
      lines.push(`${label} ${periodParts.join(' | ')}`.trim())
      return
    }

    if (/^1W\b/.test(trimmed) && trimmed.includes(',')) {
      const periodParts = trimmed
        .replace(/\.$/, '')
        .split(/,\s*/)
        .filter(Boolean)
        .map((part) => part.trim())
      lines.push(periodParts.join(' | '))
      return
    }

    lines.push(trimmed)
  })

  return lines.join('\n')
}

const renderTrendMetricsWithColor = (text: string): ReactNode[] => {
  const metricPattern = /([+-]\d+(?:\.\d+)?(?:%|pp))/g
  return text.split(metricPattern).map((part, index) => {
    if (/^[+-]\d+(?:\.\d+)?(?:%|pp)$/.test(part)) {
      const isPositive = part.startsWith('+')
      return (
        <span key={`metric-${index}`} style={{ color: isPositive ? 'var(--md-positive)' : 'var(--md-negative)', fontWeight: 600 }}>
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
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [isNarrowPhone, setIsNarrowPhone] = useState<boolean>(false)

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
    fetchSummary()
    const intervalId = window.setInterval(fetchSummary, 24 * 60 * 60 * 1000)
    return () => window.clearInterval(intervalId)
  }, [allTickers.join(','), viewMode, normalizationTicker, selectedDate])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)')
    const updateLayout = () => setIsMobile(mediaQuery.matches)
    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 415px)')
    const updateLayout = () => setIsNarrowPhone(mediaQuery.matches)
    updateLayout()
    mediaQuery.addEventListener('change', updateLayout)
    return () => mediaQuery.removeEventListener('change', updateLayout)
  }, [])

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
        <div style={{ fontSize: '12px', color: 'var(--md-text-muted)' }}>
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
      <div style={{ border: '1px solid var(--md-border)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--md-surface-muted)' }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--md-text)' }}>{title}</div>
        {viewMode === 'relative' && normalizationTicker ? (
          <div style={{ fontSize: '11px', color: 'var(--md-text-muted)', marginBottom: '6px' }}>
            Benchmark: {normalizationTicker}
          </div>
        ) : null}
        <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: '2px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `${isNarrowPhone ? 96 : 120}px repeat(${periods.length}, minmax(${isNarrowPhone ? 64 : 72}px, 1fr))`, gap: '6px', fontSize: '12px', minWidth: `${(isNarrowPhone ? 96 : 120) + periods.length * (isNarrowPhone ? 68 : 78)}px`, width: 'max-content' }}>
          <div style={{ color: 'var(--md-text-muted)' }}>Ticker</div>
          {periods.map((period) => (
            <div key={period} style={{ color: 'var(--md-text-muted)' }}>{period}</div>
          ))}
          {sortedTickers.map((ticker) => {
            const row = summary?.tickers?.[ticker]
            return (
              <Fragment key={ticker}>
                <div style={{ fontWeight: 600, color: 'var(--md-text)' }}>{ticker}</div>
                {periods.map((period) => {
                  const value = row?.returns?.[period]
                  const color = value !== undefined ? (value >= 0 ? 'var(--md-positive)' : 'var(--md-negative)') : 'var(--md-text-muted)'
                  return (
                    <div key={`${ticker}-${period}`} style={{ color }}>
                      {value !== undefined ? formatReturn(value) : '—'}
                    </div>
                  )
                })}
              </Fragment>
            )
          })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      marginTop: '20px',
      backgroundColor: 'var(--md-surface)',
      border: '1px solid var(--md-border)',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--md-text)' }}>Performance Summary</h2>
          <div style={{ fontSize: '12px', color: 'var(--md-text-muted)' }}>
            Auto-refreshes daily while open. Summarizes 1W/1M/1Q/6M/1Y returns.
            {summary?.asOf ? ` As of ${summary.asOf}.` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--md-border-strong)',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'var(--md-input-bg)',
            }}
          />
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid var(--md-border-strong)',
              borderRadius: '8px',
              fontSize: '12px',
              backgroundColor: 'var(--md-input-bg)',
            }}
          >
            <option value="absolute">Pure Cumulative Return</option>
            <option value="relative">Normalized vs Benchmark</option>
          </select>
          <button
            onClick={fetchSummary}
            disabled={loading}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--md-primary)',
              color: 'var(--md-on-primary)',
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
        <div style={{ color: 'var(--md-negative)', fontSize: '12px', marginBottom: '8px' }}>
          {error}
        </div>
      )}
      {summary?.analysis && (
        <div style={{ marginBottom: '12px', border: '1px solid var(--md-border)', borderRadius: '6px', padding: '10px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>Market Summary</div>
          {summary.analysis.marketSummaryByPeriod && summary.analysis.marketSummaryByPeriod.length > 0 ? (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isNarrowPhone ? '1fr' : 'repeat(4, minmax(0, 1fr))',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                {summary.analysis.marketSummaryByPeriod.map((col) => {
                  const periodLabel =
                    col.period === '1M'
                      ? '1 month'
                      : col.period === '1Q'
                        ? '1 quarter'
                        : col.period === '6M'
                          ? '6 months'
                          : '1 year'
                  return (
                    <div
                      key={col.period}
                      style={{
                        border: '1px solid var(--md-border)',
                        borderRadius: '6px',
                        padding: '10px',
                        backgroundColor: 'var(--md-surface-card)',
                        minWidth: 0,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', color: 'var(--md-text)' }}>
                        {periodLabel}
                        <span style={{ fontWeight: 600, color: 'var(--md-text-muted)', marginLeft: '6px' }}>({col.period})</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: '10px',
                          alignItems: 'flex-start',
                          marginBottom: '8px',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--md-text-subtle)', marginBottom: '4px' }}>Top leaders</div>
                          {col.leaders.length === 0 ? (
                            <div style={{ color: 'var(--md-text-muted)' }}>—</div>
                          ) : (
                            col.leaders.map((item) => (
                              <div key={item.ticker} style={{ fontSize: '11px', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>{item.ticker}</span>{' '}
                                <span style={{ color: item.value >= 0 ? 'var(--md-positive)' : 'var(--md-negative)', fontWeight: 600 }}>
                                  {formatReturn(item.value)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            borderLeft: '1px solid var(--md-border)',
                            paddingLeft: '10px',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--md-text-subtle)', marginBottom: '4px' }}>Bottom laggards</div>
                          {col.laggards.length === 0 ? (
                            <div style={{ color: 'var(--md-text-muted)' }}>—</div>
                          ) : (
                            col.laggards.map((item) => (
                              <div key={item.ticker} style={{ fontSize: '11px', lineHeight: 1.45 }}>
                                <span style={{ fontWeight: 600 }}>{item.ticker}</span>{' '}
                                <span style={{ color: item.value >= 0 ? 'var(--md-positive)' : 'var(--md-negative)', fontWeight: 600 }}>
                                  {formatReturn(item.value)}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--md-text-subtle)' }}>
                        <span style={{ fontWeight: 600 }}>{trendBenchmark} baseline: </span>
                        {col.benchmarkPct !== null ? (
                          <span style={{ color: col.benchmarkPct >= 0 ? 'var(--md-positive)' : 'var(--md-negative)', fontWeight: 600 }}>
                            {formatReturn(col.benchmarkPct)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--md-text-muted)' }}>—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : null}
          <div style={{ fontSize: '12px', color: 'var(--md-text)', marginBottom: '8px' }}>
            Trend flags raised: {summary.analysis.trendFlagsCount ?? summary.analysis.trendFlags?.length ?? 0}. Rotation signals:{' '}
            {summary.analysis.rotationSignalsCount ?? summary.analysis.rotationSignals?.length ?? 0}.
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
                border: '1px solid var(--md-info-icon-border)',
                color: 'var(--md-info-icon-fg)',
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
          <div
            style={{
              marginTop: '6px',
              marginBottom: '8px',
              border: '1px solid var(--md-border-strong)',
              borderRadius: '6px',
              backgroundColor: 'var(--md-surface-muted)',
              padding: '8px',
              fontSize: '11px',
              color: 'var(--md-text-subtle)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: '4px' }}>How momentum is calculated</div>
            <div>- Momentum Improving: <span style={{ fontFamily: 'monospace' }}>1W &gt; 1M &gt; 1Q</span></div>
            <div>- Momentum Deteriorating: <span style={{ fontFamily: 'monospace' }}>1W &lt; 1M &lt; 1Q</span></div>
            <div>- Short-term acceleration/fade (pp): <span style={{ fontFamily: 'monospace' }}>(1W - 1Q) x 100</span></div>
            <div>- Vs benchmark values show excess return vs selected normalization ticker.</div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--md-text)' }}>
            {summary.analysis.trendFlags.length === 0 ? (
              <div>- No major trend flags detected.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '6px' }}>
                {groupedTrendFlags.map((group) => {
                  const isPositive = group.signal.includes('Outperformance') || group.signal.includes('Improving')
                  const isNegative = group.signal.includes('Underperformance') || group.signal.includes('Deteriorating')
                  const headerBg = isPositive
                    ? 'var(--md-pos-muted-bg)'
                    : isNegative
                      ? 'var(--md-neg-muted-bg)'
                      : 'var(--md-surface-muted)'
                  const headerColor = isPositive
                    ? 'var(--md-pos-text-strong)'
                    : isNegative
                      ? 'var(--md-neg-text-strong)'
                      : 'var(--md-text-subtle)'
                  const cardBorder = isPositive
                    ? 'var(--md-pos-muted-border)'
                    : isNegative
                      ? 'var(--md-neg-muted-border)'
                      : 'var(--md-border-strong)'
                  return (
                    <div key={group.signal} style={{ border: `1px solid ${cardBorder}`, borderRadius: '6px', padding: '8px', backgroundColor: 'var(--md-surface)' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px', backgroundColor: headerBg, color: headerColor, display: 'inline-block', marginBottom: '8px' }}>
                        {group.signal}
                      </div>
                      {group.items.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--md-text-muted)' }}>No tickers</div>
                      ) : (
                        group.items.map((flag, index) => {
                          const stackedDetails = formatTrendFlagDetails(flag.details)
                          return (
                            <div key={`flag-${group.signal}-${flag.ticker}-${index}`} style={{ marginBottom: '8px' }}>
                              <div style={{ fontWeight: 700, fontSize: '12px' }}>{flag.ticker}</div>
                              <div style={{ fontSize: '12px', color: 'var(--md-text-subtle)' }}>
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
          <div style={{ fontSize: '12px', color: 'var(--md-text)' }}>
            {summary.analysis.rotationSignals.map((signal, index) => (
              <div key={`rotation-${index}`}>- {signal}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: isNarrowPhone ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))', gap: '12px' }}>
        {renderTable('Sector Watch (Broad Market)', sectorTickers)}
        {renderTable('Interest Watch List', watchListTickers)}
      </div>
    </div>
  )
}
