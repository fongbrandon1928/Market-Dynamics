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
    <div style={{
      marginTop: '20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>
          Sector Daily Returns{headerDate ? ` (${headerDate})` : ''}
        </h2>
        {sectorLoading && (
          <span style={{ fontSize: '12px', color: '#6B7280' }}>Loading...</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Timeframe</label>
        <select
          value={sectorPeriod}
          onChange={(e) => onSectorPeriodChange(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            fontSize: '12px',
            backgroundColor: 'white',
          }}
        >
          <option value="1D">1 Day</option>
          <option value="1W">1 Week</option>
          <option value="1M">1 Month</option>
          <option value="1Q">1 Quarter</option>
        </select>
      </div>
      {sectorError && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {sectorError}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
        {etfTickers.map((ticker) => {
          const data = sectorReturns[ticker]
          const returnColor = data ? (data.dailyReturn >= 0 ? '#16A34A' : '#DC2626') : '#6B7280'
          return (
            <div key={ticker} style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{ticker}</div>
              {data ? (
                <div style={{ fontSize: '13px', color: '#111827' }}>
                  {data.price.toFixed(2)}{' '}
                  <span style={{ color: returnColor }}>
                    ({(data.dailyReturn * 100).toFixed(2)}%)
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#6B7280' }}>No data</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
