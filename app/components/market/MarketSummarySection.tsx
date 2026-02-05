type MarketSummarySectionProps = {
  marketSummary: string
  marketSummaryLoading: boolean
  marketSummaryError: string
  onGenerateSummary: () => void
}

export default function MarketSummarySection({
  marketSummary,
  marketSummaryLoading,
  marketSummaryError,
  onGenerateSummary,
}: MarketSummarySectionProps) {
  return (
    <div style={{
      marginTop: '20px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '8px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Market Summary</h2>
        <button
          onClick={onGenerateSummary}
          disabled={marketSummaryLoading}
          style={{
            padding: '8px 14px',
            backgroundColor: '#1E3A8A',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: marketSummaryLoading ? 'not-allowed' : 'pointer',
            opacity: marketSummaryLoading ? 0.6 : 1,
          }}
        >
          {marketSummaryLoading ? 'Generating...' : 'Get Summary'}
        </button>
      </div>
      {marketSummaryError && (
        <div style={{ color: '#DC2626', fontSize: '12px', marginBottom: '8px' }}>
          {marketSummaryError}
        </div>
      )}
      {marketSummary && (
        <div style={{ whiteSpace: 'pre-line', fontSize: '14px', color: '#111827' }}>
          {marketSummary}
        </div>
      )}
      {!marketSummary && !marketSummaryError && (
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          Uses Pollinations API with a server-side key.
        </div>
      )}
    </div>
  )
}
