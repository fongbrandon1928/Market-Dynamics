type SectorRelative = Record<string, { value: number; change: number; date: string }>

type SectorRelativeSectionProps = {
  etfTickers: string[]
  sectorRelative: SectorRelative
  sectorRelativeLoading: boolean
  sectorRelativeError: string
}

const getFirstDate = (values: Record<string, { date: string }>): string => {
  const match = Object.values(values).find((item) => !!item?.date)
  return match?.date || ''
}

export default function SectorRelativeSection({
  etfTickers,
  sectorRelative,
  sectorRelativeLoading,
  sectorRelativeError,
}: SectorRelativeSectionProps) {
  const headerDate = getFirstDate(sectorRelative)
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
          Sector Relative Price vs SPY{headerDate ? ` (${headerDate})` : ''}
        </h2>
        {sectorRelativeLoading && (
          <span style={{ fontSize: '12px', color: '#6B7280' }}>Loading...</span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
        Scaled to 100 at the start of the selected period. Values show relative price vs SPY; daily change shows the most recent move in the relative series.
      </div>
      {sectorRelativeError && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {sectorRelativeError}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
        {etfTickers.map((ticker) => {
          const data = sectorRelative[ticker]
          const changeColor = data ? (data.change >= 0 ? '#16A34A' : '#DC2626') : '#6B7280'
          return (
            <div key={ticker} style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>{ticker}</div>
              {data ? (
                <div style={{ fontSize: '13px', color: '#111827' }}>
                  {data.value.toFixed(2)}
                  <span style={{ marginLeft: '6px', color: changeColor }}>
                    {data.change >= 0 ? '+' : ''}
                    {(data.change * 100).toFixed(2)}%
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
