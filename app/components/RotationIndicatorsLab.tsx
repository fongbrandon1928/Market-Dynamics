'use client'

import { useState } from 'react'
import { format } from 'date-fns'

type ApiResponse = {
  asOf: string
  benchmark: string
  warnings: string[]
  trend: {
    leaders: Array<{ ticker: string; r1w: number }>
    laggards: Array<{ ticker: string; r1w: number }>
  }
  relativeStrength: Array<{ ticker: string; rs1m: number; rs1q: number }>
  rankChanges: {
    fullRankList: Array<{ ticker: string; currentRank: number; previousRank: number; shift: number; currentRs1w: number; previousRs1m: number }>
    topImprovers: Array<{ ticker: string; currentRank: number; previousRank: number; shift: number; currentRs1w: number; previousRs1m: number }>
    topDecliners: Array<{ ticker: string; currentRank: number; previousRank: number; shift: number; currentRs1w: number; previousRs1m: number }>
  }
  offenseDefense: {
    offensive1w: number
    defensive1w: number
    spread1w: number
    offensive1m: number
    defensive1m: number
    spread1m: number
  }
  momentum: {
    strongestAcceleration: Array<{ ticker: string; accel: number }>
    weakestAcceleration: Array<{ ticker: string; accel: number }>
  }
  movingAverages: {
    leadersBySpread: Array<{ ticker: string; ma20: number; ma63: number; spread: number; signal: string; crossover: string }>
    laggardsBySpread: Array<{ ticker: string; ma20: number; ma63: number; spread: number; signal: string; crossover: string }>
    bullishCrossovers: string[]
    bearishCrossovers: string[]
  }
  dispersion: {
    oneWeekSpread: number
  }
  rotationSignals: string[]
}

const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`
const signed = (v: number) => `${v >= 0 ? '+' : ''}${v}`

const shiftStyle = (shift: number) => ({
  color: shift > 0 ? '#166534' : shift < 0 ? '#991B1B' : '#374151',
  backgroundColor: shift > 0 ? '#DCFCE7' : shift < 0 ? '#FEE2E2' : '#F3F4F6',
  border: `1px solid ${shift > 0 ? '#86EFAC' : shift < 0 ? '#FCA5A5' : '#D1D5DB'}`,
})

export default function RotationIndicatorsLab() {
  const [toDate, setToDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [lookbackDays, setLookbackDays] = useState<string>('180')
  const [benchmarkTicker, setBenchmarkTicker] = useState<string>('SPY')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [data, setData] = useState<ApiResponse | null>(null)

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ to: toDate, lookbackDays, benchmark: benchmarkTicker.trim().toUpperCase() || 'SPY' })
      const response = await fetch(`/api/rotation-indicators?${params.toString()}`)
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body?.error || 'Failed to fetch indicators')
      }
      setData(body)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch indicators')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '32px', fontWeight: 'bold' }}>
        Sector Rotation Indicators (Test)
      </h1>
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', marginBottom: '12px', backgroundColor: '#FFFFFF', display: 'grid', gridTemplateColumns: '1fr 1fr 120px auto', gap: '8px' }}>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
        <input value={lookbackDays} onChange={(e) => setLookbackDays(e.target.value)} placeholder="Lookback days" style={{ padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px' }} />
        <input value={benchmarkTicker} onChange={(e) => setBenchmarkTicker(e.target.value.toUpperCase())} placeholder="Benchmark" style={{ padding: '8px', border: '1px solid #D1D5DB', borderRadius: '6px', textTransform: 'uppercase' }} />
        <button onClick={run} disabled={loading} style={{ padding: '8px 14px', border: 'none', borderRadius: '14px', backgroundColor: '#1E3A8A', color: '#FFFFFF', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Running...' : 'Run Indicators'}
        </button>
      </div>
      {error ? <div style={{ color: '#DC2626', marginBottom: '8px', fontSize: '13px' }}>{error}</div> : null}
      {data?.warnings?.length ? (
        <div style={{ border: '1px solid #F59E0B', backgroundColor: '#FFFBEB', color: '#92400E', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '12px' }}>
          {data.warnings.map((w, idx) => <div key={`warn-${idx}`}>- {w}</div>)}
        </div>
      ) : null}
      {data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 0.85fr) minmax(560px, 1.15fr)', gap: '12px', alignItems: 'start' }}>
          {(() => {
            const movingAverages = data.movingAverages || {
              leadersBySpread: [],
              laggardsBySpread: [],
              bullishCrossovers: [],
              bearishCrossovers: [],
            }
            const fullRankList = data.rankChanges?.fullRankList || []
            return (
              <>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', gridColumn: '1 / 2' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>1) Relative Performance Trend</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: 1W return = (latest close / close 5 trading days ago) - 1. Leaders are highest 1W returns; laggards are lowest.
            </div>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>Leaders (1W)</div>
            {data.trend.leaders.map((row) => <div key={`lead-${row.ticker}`} style={{ fontSize: '12px' }}>{row.ticker}: {pct(row.r1w)}</div>)}
            <div style={{ fontSize: '12px', marginTop: '8px', marginBottom: '4px' }}>Laggards (1W)</div>
            {data.trend.laggards.map((row) => <div key={`lag-${row.ticker}`} style={{ fontSize: '12px' }}>{row.ticker}: {pct(row.r1w)}</div>)}
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', gridColumn: '2 / 3', gridRow: '1 / span 2' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>2) Rank Change / Leadership Shift</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: rank by {data.benchmark}-relative returns (RS) where RS = ticker return - {data.benchmark} return. Current rank uses RS(1W), previous rank uses RS(1M), and shift = previousRank - currentRank.
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              Interpretation: positive shift means leadership is strengthening (rank improved), negative shift means leadership is fading. Larger absolute values imply faster rotation pressure.
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' }}>Positive shift = improving leadership</span>
              <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '999px', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' }}>Negative shift = weakening leadership</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.85fr) minmax(420px, 1.15fr)', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Top Improvers</div>
                {data.rankChanges.topImprovers.map((row) => (
                  <div key={`impr-${row.ticker}`} style={{ fontSize: '11px', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '5px 6px', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{row.ticker}</span>
                      <span style={{ ...shiftStyle(row.shift), borderRadius: '999px', padding: '1px 7px', fontWeight: 700 }}>{signed(row.shift)}</span>
                    </div>
                    <div style={{ marginTop: '3px', whiteSpace: 'nowrap' }}>
                      Rank #{row.previousRank} -&gt; #{row.currentRank} | RS(1W) {pct(row.currentRs1w)} | RS(1M) {pct(row.previousRs1m)}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: '12px', marginTop: '8px', marginBottom: '4px', fontWeight: 600 }}>Top Decliners</div>
                {data.rankChanges.topDecliners.map((row) => (
                  <div key={`decl-${row.ticker}`} style={{ fontSize: '11px', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '5px 6px', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{row.ticker}</span>
                      <span style={{ ...shiftStyle(row.shift), borderRadius: '999px', padding: '1px 7px', fontWeight: 700 }}>{signed(row.shift)}</span>
                    </div>
                    <div style={{ marginTop: '3px', whiteSpace: 'nowrap' }}>
                      Rank #{row.previousRank} -&gt; #{row.currentRank} | RS(1W) {pct(row.currentRs1w)} | RS(1M) {pct(row.previousRs1m)}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '12px', marginBottom: '4px', fontWeight: 600 }}>Full Rank List</div>
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '52px 48px 52px 58px 1fr', gap: '6px', fontSize: '11px', color: '#6B7280', borderBottom: '1px solid #E5E7EB', paddingBottom: '4px', marginBottom: '4px' }}>
                    <span>Ticker</span>
                    <span>Now</span>
                    <span>Was</span>
                    <span>Shift</span>
                    <span>RS(1W) / RS(1M)</span>
                  </div>
                  {fullRankList.map((row) => (
                    <div key={`full-${row.ticker}`} style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '52px 48px 52px 58px 1fr', gap: '6px', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #F3F4F6' }}>
                      <span style={{ fontWeight: 700 }}>{row.ticker}</span>
                      <span>#{row.currentRank}</span>
                      <span>#{row.previousRank}</span>
                      <span>
                        <span style={{ ...shiftStyle(row.shift), borderRadius: '999px', padding: '1px 7px', fontWeight: 700 }}>{signed(row.shift)}</span>
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>{pct(row.currentRs1w)} / {pct(row.previousRs1m)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', gridColumn: '1 / 2' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>3) Offense vs Defensive + Relative Strength</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: offense/defensive returns are group averages. Spread = offense average - defensive average. Relative strength = sector return - {data.benchmark} return for the same window.
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              Definitions: offensive = XLK, XLY, XLI, XLF, SMH, IWM, QQQ; defensive = XLP, XLU, XLV.
            </div>
            <div style={{ fontSize: '12px' }}>Offense 1W: {pct(data.offenseDefense.offensive1w)} | Defensive 1W: {pct(data.offenseDefense.defensive1w)}</div>
            <div style={{ fontSize: '12px' }}>Spread 1W: {pct(data.offenseDefense.spread1w)}</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>Top RS (1M vs {data.benchmark})</div>
            {data.relativeStrength.slice(0, 5).map((row) => <div key={`rs-${row.ticker}`} style={{ fontSize: '12px' }}>{row.ticker}: {pct(row.rs1m)}</div>)}
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', gridColumn: '1 / 2' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>4) Momentum + Dispersion</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: acceleration = 1W return - 1M return (positive means momentum is improving). Dispersion = top 1W return - bottom 1W return.
            </div>
            <div style={{ fontSize: '12px' }}>1W dispersion spread: {pct(data.dispersion.oneWeekSpread)}</div>
            <div style={{ fontSize: '12px', marginTop: '8px' }}>Strongest acceleration</div>
            {data.momentum.strongestAcceleration.map((row) => <div key={`momup-${row.ticker}`} style={{ fontSize: '12px' }}>{row.ticker}: {pct(row.accel)}</div>)}
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', gridColumn: '2 / 3' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>5) Moving Averages (20D vs 3M)</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: 20D MA = average close of last 20 sessions; 3M MA = average close of last 63 sessions. Spread = (20D MA / 3M MA) - 1.
              Crossovers compare yesterday and today MA relationships.
            </div>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>Top positive MA spreads</div>
            {movingAverages.leadersBySpread.map((row) => (
              <div key={`ma-up-${row.ticker}`} style={{ fontSize: '12px' }}>
                {row.ticker}: {pct(row.spread)} ({row.signal})
              </div>
            ))}
            <div style={{ fontSize: '12px', marginTop: '8px', marginBottom: '4px' }}>Top negative MA spreads</div>
            {movingAverages.laggardsBySpread.map((row) => (
              <div key={`ma-down-${row.ticker}`} style={{ fontSize: '12px' }}>
                {row.ticker}: {pct(row.spread)} ({row.signal})
              </div>
            ))}
            <div style={{ fontSize: '12px', marginTop: '8px' }}>
              Bullish crossovers: {movingAverages.bullishCrossovers.length ? movingAverages.bullishCrossovers.join(', ') : 'None'}
            </div>
            <div style={{ fontSize: '12px' }}>
              Bearish crossovers: {movingAverages.bearishCrossovers.length ? movingAverages.bearishCrossovers.join(', ') : 'None'}
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>Automated Sector Rotation Discovery</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '8px' }}>
              How calculated: heuristic triggers fire when relationships imply early rotation (e.g., IWM &gt; QQQ on 1W while IWM &lt; QQQ on 1Q, or offensive/defensive rank-shift transitions).
            </div>
            {data.rotationSignals.map((signal, idx) => <div key={`signal-${idx}`} style={{ fontSize: '12px' }}>- {signal}</div>)}
          </div>
              </>
            )
          })()}
        </div>
      ) : null}
    </div>
  )
}
