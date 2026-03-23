'use client'

type ControlsPanelProps = {
  tickerList: string
  onTickerListChange: (value: string) => void
  startDate: string
  onStartDateChange: (value: string) => void
  endDate: string
  onEndDateChange: (value: string) => void
  normalizationTicker: string
  onNormalizationTickerChange: (value: string) => void
  selectedETF: string
  onETFChange: (value: string) => void
  etfTickers: string[]
  onGenerate: () => void
  onSectorRotation: () => void
  loading: boolean
}

export default function ControlsPanel({
  tickerList,
  onTickerListChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  normalizationTicker,
  onNormalizationTickerChange,
  selectedETF,
  onETFChange,
  etfTickers,
  onGenerate,
  onSectorRotation,
  loading,
}: ControlsPanelProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid var(--md-border)',
        borderRadius: '8px',
        backgroundColor: 'var(--md-surface)',
        padding: '12px',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--md-text)' }}>Ticker List</label>
        <textarea
          value={tickerList}
          onChange={(e) => onTickerListChange(e.target.value)}
          placeholder="Enter tickers separated by commas"
          style={{
            width: '100%',
            minHeight: '120px',
            resize: 'none',
            padding: '10px',
            border: '2px solid var(--md-accent-blue-border)',
            borderRadius: '4px',
            backgroundColor: 'var(--md-accent-blue-bg)',
            fontSize: '14px',
            fontFamily: 'monospace',
            color: 'var(--md-text)',
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--md-text)' }}>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px solid var(--md-accent-green-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--md-accent-green-bg)',
              fontSize: '14px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--md-text)' }}>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '2px solid var(--md-accent-green-border)',
              borderRadius: '4px',
              backgroundColor: 'var(--md-accent-green-bg)',
              fontSize: '14px',
            }}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--md-text)' }}>Normalization Ticker</label>
        <input
          type="text"
          value={normalizationTicker}
          onChange={(e) => onNormalizationTickerChange(e.target.value)}
          placeholder="e.g., SPY"
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid var(--md-accent-blue-border)',
            borderRadius: '4px',
            backgroundColor: 'var(--md-accent-blue-bg)',
            fontSize: '14px',
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: 'var(--md-text)' }}>Select ETF</label>
        <select
          value={selectedETF}
          onChange={(e) => onETFChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            border: '2px solid var(--md-border-strong)',
            borderRadius: '4px',
            backgroundColor: 'var(--md-input-bg)',
            fontSize: '14px',
            appearance: 'none',
            color: 'var(--md-text)',
            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            backgroundSize: '16px',
            paddingRight: '35px',
          }}
        >
          <option value="">Select an ETF...</option>
          {etfTickers.map((ticker) => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          onClick={onGenerate}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--md-primary)',
            color: 'var(--md-on-primary)',
            border: 'none',
            borderRadius: '20px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            width: '100%',
          }}
        >
          {loading ? 'Generating...' : 'Generate'}
        </button>

        <button
          onClick={onSectorRotation}
          style={{
            padding: '12px 24px',
            backgroundColor: 'var(--md-primary)',
            color: 'var(--md-on-primary)',
            border: 'none',
            borderRadius: '20px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Sector Rotation
        </button>
      </div>
    </div>
  )
}
