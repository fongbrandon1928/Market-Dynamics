'use client'

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
    <div
      style={{
        marginTop: '20px',
        backgroundColor: 'var(--md-surface)',
        border: '1px solid var(--md-border)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--md-text)' }}>Market Summary</h2>
        <button
          onClick={onGenerateSummary}
          disabled={marketSummaryLoading}
          style={{
            padding: '8px 14px',
            backgroundColor: 'var(--md-primary)',
            color: 'var(--md-on-primary)',
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
        <div style={{ color: 'var(--md-negative)', fontSize: '12px', marginBottom: '8px' }}>{marketSummaryError}</div>
      )}
      {marketSummary && (
        <div style={{ whiteSpace: 'pre-line', fontSize: '14px', color: 'var(--md-text)' }}>{marketSummary}</div>
      )}
      {!marketSummary && !marketSummaryError && (
        <div style={{ fontSize: '12px', color: 'var(--md-text-muted)' }}>Uses Pollinations API with a server-side key.</div>
      )}
    </div>
  )
}
