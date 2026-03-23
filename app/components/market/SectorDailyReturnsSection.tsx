'use client'

type SectorReturns = Record<string, { dailyReturn: number; date: string; price: number }>

type SectorDailyReturnsSectionProps = {
  etfTickers: string[]
  sectorReturns: SectorReturns
  sectorLoading: boolean
  sectorError: string
  sectorPeriod: string
  onSectorPeriodChange: (value: string) => void
}

const getFirstDate = (values: Record<string, { date: string }>): string => {
  const match = Object.values(values).find((item) => !!item?.date)
  return match?.date || ''
}

export default function SectorDailyReturnsSection({
  etfTickers,
  sectorReturns,
  sectorLoading,
  sectorError,
  sectorPeriod,
  onSectorPeriodChange,
}: SectorDailyReturnsSectionProps) {
  const headerDate = getFirstDate(sectorReturns)
  return (
    <div
      style={{
        marginTop: '20px',
        backgroundColor: 'var(--md-surface)',
        border: '1px solid var(--md-border)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '10px',
        }}
      >
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--md-text)' }}>
          Sector Period Return{headerDate ? ` (${headerDate})` : ''}
        </h2>
        {sectorLoading && <span style={{ fontSize: '12px', color: 'var(--md-text-muted)' }}>Loading...</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--md-text-subtle)' }}>Timeframe</label>
        <select
          value={sectorPeriod}
          onChange={(e) => onSectorPeriodChange(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--md-border-strong)',
            borderRadius: '8px',
            fontSize: '12px',
            backgroundColor: 'var(--md-input-bg)',
            color: 'var(--md-text)',
          }}
        >
          <option value="1D">1 Day</option>
          <option value="1W">1 Week</option>
          <option value="1M">1 Month</option>
          <option value="1Q">1 Quarter</option>
          <option value="1Y">1 Year</option>
          <option value="2Y">2 Years</option>
          <option value="5Y">5 Years</option>
        </select>
      </div>
      {sectorError && (
        <div style={{ color: 'var(--md-negative)', fontSize: '12px', marginBottom: '8px' }}>{sectorError}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        {etfTickers.map((ticker) => {
          const data = sectorReturns[ticker]
          const returnColor = data ? (data.dailyReturn >= 0 ? 'var(--md-positive)' : 'var(--md-negative)') : 'var(--md-text-muted)'
          return (
            <div
              key={ticker}
              style={{ border: '1px solid var(--md-border)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--md-surface-muted)' }}
            >
              <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--md-text)' }}>{ticker}</div>
              {data ? (
                <div style={{ fontSize: '13px', color: 'var(--md-text)' }}>
                  {data.price.toFixed(2)}
                  <span style={{ marginLeft: '6px', color: returnColor }}>
                    {data.dailyReturn >= 0 ? '+' : ''}
                    {(data.dailyReturn * 100).toFixed(2)}%
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--md-text-muted)' }}>No data</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
