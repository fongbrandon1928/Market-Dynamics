type SectorRotationSectionProps = {
  rotationData: any
  sectorLoading: boolean
  sectorError: string
  sectorPeriod: string
}

export default function SectorRotationSection({
  rotationData,
  sectorLoading,
  sectorError,
  sectorPeriod,
}: SectorRotationSectionProps) {
  const sectors = rotationData?.sectors || {}
  const sectorEntries = Object.entries(sectors)
    .map(([ticker, data]: [string, any]) => ({
      ticker,
      periodReturn: Number(data?.periodReturn ?? 0),
      rsIndex: Number(data?.rsIndex ?? 0),
      rsMomentum: Number(data?.rsMomentum ?? 0),
      quadrant: String(data?.quadrant ?? ''),
      belowMA20: Boolean(data?.belowMA20),
      belowMA50: Boolean(data?.belowMA50),
      volatility: Number(data?.volatility ?? 0),
    }))

  const leading = sectorEntries.filter((item) => item.quadrant === 'Leading')
  const lagging = sectorEntries.filter((item) => item.quadrant === 'Lagging')
  const improving = sectorEntries.filter((item) => item.quadrant === 'Improving')
  const weakening = sectorEntries.filter((item) => item.quadrant === 'Weakening')

  const topRelative = [...sectorEntries].sort((a, b) => b.rsIndex - a.rsIndex).slice(0, 3)
  const bottomRelative = [...sectorEntries].sort((a, b) => a.rsIndex - b.rsIndex).slice(0, 3)

  const ma20Breaks = sectorEntries.filter((item) => item.belowMA20).length
  const ma50Breaks = sectorEntries.filter((item) => item.belowMA50).length
  const topVolatility = [...sectorEntries].sort((a, b) => b.volatility - a.volatility).slice(0, 3)

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
        Methodology uses relative strength vs SPY, RRG quadrants, offense vs defensive leadership,
        yield curve regime, and trend/volatility checks.
      </div>
      {sectorError && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {sectorError}
        </div>
      )}
      {!sectorError && !sectorEntries.length && (
        <div style={{ fontSize: '12px', color: '#6B7280' }}>Not enough data to evaluate rotation.</div>
      )}
      {sectorEntries.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>
              {rotationData?.rotationDetected ? 'Rotation detected' : 'No clear rotation signal'}
            </div>
            <div style={{ fontSize: '12px', color: '#374151' }}>
              Dispersion: {((rotationData?.dispersion ?? 0) * 100).toFixed(2)}% | Period: {sectorPeriod}
            </div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
              Offense vs Defensive: {(rotationData?.offenseDefensive?.spread ?? 0 * 100).toFixed(2)}% spread
            </div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
              Yield Curve: {(rotationData?.yieldCurve?.spread ?? 0).toFixed(2)} (10Y-3M)
            </div>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>RRG Quadrants</div>
            <div style={{ fontSize: '12px', color: '#111827' }}>
              Leading: {leading.map((item) => item.ticker).join(', ') || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Improving: {improving.map((item) => item.ticker).join(', ') || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Weakening: {weakening.map((item) => item.ticker).join(', ') || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Lagging: {lagging.map((item) => item.ticker).join(', ') || 'None'}
            </div>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>Relative Strength Leaders</div>
            <div style={{ fontSize: '12px', color: '#111827' }}>
              Top: {topRelative.map((item) => `${item.ticker} ${item.rsIndex.toFixed(1)}`).join(', ') || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Bottom: {bottomRelative.map((item) => `${item.ticker} ${item.rsIndex.toFixed(1)}`).join(', ') || 'None'}
            </div>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>Trend & Volatility</div>
            <div style={{ fontSize: '12px', color: '#111827' }}>
              Below MA20: {ma20Breaks} | Below MA50: {ma50Breaks}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Highest vol: {topVolatility.map((item) => `${item.ticker} ${(item.volatility * 100).toFixed(2)}%`).join(', ') || 'None'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
