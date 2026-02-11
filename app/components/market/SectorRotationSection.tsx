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

  const technicals = rotationData?.technicals || {}
  const above40 = Array.isArray(technicals.above40) ? technicals.above40 : []
  const below40 = Array.isArray(technicals.below40) ? technicals.below40 : []
  const breakAbove40 = Array.isArray(technicals.breakAbove40) ? technicals.breakAbove40 : []
  const breakBelow40 = Array.isArray(technicals.breakBelow40) ? technicals.breakBelow40 : []

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
          <div style={{
            border: rotationData?.rotationDetected ? '1px solid #16A34A' : '1px solid #E5E7EB',
            borderRadius: '6px',
            padding: '10px',
            backgroundColor: rotationData?.rotationDetected ? '#F0FDF4' : '#FFFFFF',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ fontWeight: '600' }}>
                {rotationData?.rotationDetected ? 'Rotation detected' : 'No clear rotation signal'}
              </div>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: rotationData?.rotationDetected ? '#DCFCE7' : '#E5E7EB',
                color: rotationData?.rotationDetected ? '#166534' : '#374151',
                fontWeight: 600,
              }}>
                {rotationData?.rotationDetected ? 'Active' : 'Neutral'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#374151' }}>
              Dispersion: {((rotationData?.dispersion ?? 0) * 100).toFixed(2)}% | Period: {sectorPeriod}
            </div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
              Offense vs Defensive: {(((rotationData?.offenseDefensive?.spread ?? 0) * 100)).toFixed(2)}% spread
              {rotationData?.offenseDefensive?.riskOff ? ' (Risk-off)' : ' (Risk-on)'}
            </div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
              Yield Curve: {(rotationData?.yieldCurve?.spread ?? 0).toFixed(2)} (10Y-3M)
              {rotationData?.yieldCurve?.inverted ? ' (Inverted)' : ''}
            </div>
            <div style={{ fontSize: '12px', color: '#374151', marginTop: '4px' }}>
              10Y change: {(((rotationData?.yieldCurve?.rateChange ?? 0) * 100)).toFixed(2)}% | Window: {rotationData?.periodStart} to {rotationData?.periodEnd}
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
            <div style={{ fontWeight: '600', marginBottom: '6px' }}>Technical Indicator Analysis</div>
            <div style={{ fontSize: '12px', color: '#111827' }}>
              Weekly trend: 18-week / 40-week SMAs.
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Breaks above 40W: {breakAbove40.join(', ') || 'None'} | Breaks below 40W: {breakBelow40.join(', ') || 'None'}
            </div>
            <div style={{ fontSize: '12px', color: '#111827', marginTop: '4px' }}>
              Above 40W: {above40.join(', ') || 'None'} | Below 40W: {below40.join(', ') || 'None'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
