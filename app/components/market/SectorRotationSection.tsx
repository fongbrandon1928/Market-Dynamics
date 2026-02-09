type SectorReturns = Record<string, { dailyReturn: number; date: string; price: number }>

type SectorRotationSectionProps = {
  sectorReturns: SectorReturns
  sectorLoading: boolean
  sectorError: string
  sectorPeriod: string
}

type SectorReturnPoint = {
  ticker: string
  value: number
}

const getMedian = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

const MIN_SPREAD_BY_PERIOD: Record<string, number> = {
  '1D': 1.5,
  '1W': 3,
  '1M': 5,
  '1Q': 7,
  '1Y': 10,
  '2Y': 12,
  '5Y': 15,
}

export default function SectorRotationSection({
  sectorReturns,
  sectorLoading,
  sectorError,
  sectorPeriod,
}: SectorRotationSectionProps) {
  const returns: SectorReturnPoint[] = Object.entries(sectorReturns)
    .map(([ticker, data]) => ({ ticker, value: data.dailyReturn * 100 }))
    .filter((point) => Number.isFinite(point.value))

  const hasData = returns.length >= 4
  const sorted = hasData ? [...returns].sort((a, b) => b.value - a.value) : []
  const top = sorted.slice(0, 3)
  const bottom = sorted.slice(-3).reverse()

  const max = hasData ? sorted[0].value : 0
  const min = hasData ? sorted[sorted.length - 1].value : 0
  const spread = max - min
  const medianAbs = hasData ? getMedian(sorted.map((point) => Math.abs(point.value))) : 0
  const dispersionRatio = medianAbs === 0 ? 0 : spread / medianAbs
  const minSpread = MIN_SPREAD_BY_PERIOD[sectorPeriod] ?? 3
  const hasOppositeSigns = max > 0 && min < 0
  const rotationDetected = hasOppositeSigns && spread >= minSpread && dispersionRatio >= 2

  return (
    <div style={{
      marginTop: '20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Sector Rotation Signal</h2>
        {sectorLoading && (
          <span style={{ fontSize: '12px', color: '#6B7280' }}>Loading...</span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px' }}>
        Methodology: detect rotation when leadership is split (top sector positive, bottom negative) and dispersion is high.
        We require spread &gt;= {minSpread.toFixed(1)}% and spread &gt;= 2x median absolute return.
      </div>
      {sectorError && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {sectorError}
        </div>
      )}
      {!sectorError && !hasData && (
        <div style={{ fontSize: '12px', color: '#6B7280' }}>Not enough data to evaluate rotation.</div>
      )}
      {hasData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>
              {rotationDetected ? 'Rotation detected' : 'No clear rotation signal'}
            </div>
            <div style={{ fontSize: '12px', color: '#374151' }}>
              Spread: {spread.toFixed(2)}% | Median abs: {medianAbs.toFixed(2)}% | Ratio: {dispersionRatio.toFixed(2)}x
            </div>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>Leaders / Laggards</div>
            <div style={{ fontSize: '12px', color: '#111827' }}>
              Top: {top.map((item) => `${item.ticker} ${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}%`).join(', ')}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Bottom: {bottom.map((item) => `${item.ticker} ${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}%`).join(', ')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
