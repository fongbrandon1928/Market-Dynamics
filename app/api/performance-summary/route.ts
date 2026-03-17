import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const PERIOD_DAYS: Record<string, number> = {
  '1W': 8,
  '1M': 32,
  '1Q': 93,
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

type HistoricalPoint = {
  date: Date
  close: number
}

type SummaryData = Record<string, { returns: Record<string, number>; lastDate: string }>
type AnalysisResult = {
  summary: string[]
  trendFlags: Array<{ ticker: string; signal: string; details: string }>
  rotationSignals: string[]
}

const fetchSeries = async (ticker: string, startDate: Date, endDate: Date): Promise<HistoricalPoint[]> => {
  let rows: Array<{ date?: Date; close?: number | null }> = []
  for (let dayOffset = 0; dayOffset <= 3; dayOffset += 1) {
    const queryEndDate = new Date(endDate)
    queryEndDate.setDate(queryEndDate.getDate() - dayOffset)
    try {
      rows = await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: queryEndDate,
        interval: '1d',
      })
      break
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isNullValuesError = message.includes('SOME (but not all) null values')
      if (!isNullValuesError || dayOffset === 3) {
        throw error
      }
    }
  }
  if (!rows || rows.length === 0) {
    return []
  }
  return rows
    .filter((row: { date?: Date; close?: number | null }) => row.date && typeof row.close === 'number')
    .map((row: { date?: Date; close?: number | null }) => ({
      close: row.close as number,
      date: row.date as Date,
    }))
    .sort((a: HistoricalPoint, b: HistoricalPoint) => a.date.getTime() - b.date.getTime())
}

const computeReturn = (series: HistoricalPoint[], startDate: Date): number => {
  if (series.length < 2) {
    return 0
  }
  const startPoint = series.find((point) => point.date >= startDate)
  const endPoint = series[series.length - 1]
  if (!startPoint || !endPoint || startPoint.close === 0) {
    return 0
  }
  return endPoint.close / startPoint.close - 1
}

const parseDateParam = (value: string | null): Date | null => {
  if (!value) {
    return null
  }
  const parsed = new Date(`${value}T23:59:59.999Z`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

const average = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const buildAutomatedAnalysis = (
  data: SummaryData,
  viewMode: string,
  benchmarkTicker: string,
  benchmarkReturns: Record<string, number> | null
): AnalysisResult => {
  const fmtPct = (value: number) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
  const fmtPp = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}pp`
  const periods = ['1W', '1M', '1Q']
  const tickers = Object.keys(data)
  const q1Sorted = tickers
    .map((ticker) => ({ ticker, value: data[ticker]?.returns?.['1Q'] }))
    .filter((item): item is { ticker: string; value: number } => typeof item.value === 'number')
    .sort((a, b) => b.value - a.value)
  const top3 = q1Sorted.slice(0, 3)
  const bottom3 = q1Sorted.slice(-3).reverse()

  const baselineTicker = benchmarkTicker.toUpperCase()
  const baselineReturns = benchmarkReturns || data[baselineTicker]?.returns
  const trendFlags: Array<{ ticker: string; signal: string; details: string }> = []
  const isRelativeMode = viewMode === 'relative'

  tickers.forEach((ticker) => {
    const returns = data[ticker]?.returns
    if (!returns) {
      return
    }
    const periodValues = periods.map((period) => returns[period]).filter((v): v is number => typeof v === 'number')
    if (periodValues.length !== periods.length) {
      return
    }

    // In relative mode, returns are already benchmark-relative, so 0 is the baseline.
    // In absolute mode, convert to benchmark-relative by subtracting benchmark returns.
    const rel = periods.map((period) => {
      if (isRelativeMode) {
        return returns[period] ?? 0
      }
      if (!baselineReturns) {
        return Number.NaN
      }
      return (returns[period] ?? 0) - (baselineReturns[period] ?? 0)
    })
    if (rel.every((value) => Number.isFinite(value))) {
      const rel1w = rel[0]
      const rel1m = rel[1]
      const rel1q = rel[2]
      if (rel.every((value) => value > 0)) {
        trendFlags.push({
          ticker,
          signal: 'Consistent Outperformance',
          details: `Vs ${baselineTicker}: 1W ${fmtPp(rel1w * 100)}, 1M ${fmtPp(rel1m * 100)}, 1Q ${fmtPp(rel1q * 100)}.`,
        })
      } else if (rel.every((value) => value < 0)) {
        trendFlags.push({
          ticker,
          signal: 'Consistent Underperformance',
          details: `Vs ${baselineTicker}: 1W ${fmtPp(rel1w * 100)}, 1M ${fmtPp(rel1m * 100)}, 1Q ${fmtPp(rel1q * 100)}.`,
        })
      }
    }

    if (returns['1W'] > returns['1M'] && returns['1M'] > returns['1Q']) {
      const shortTermAccelerationPp = (returns['1W'] - returns['1Q']) * 100
      const oneWeekVsBaselinePp = rel[0] * 100
      const oneMonthVsBaselinePp = rel[1] * 100
      trendFlags.push({
        ticker,
        signal: 'Momentum Improving',
        details: `1W ${fmtPct(returns['1W'])}, 1M ${fmtPct(returns['1M'])}, 1Q ${fmtPct(returns['1Q'])}. Short-term acceleration: ${fmtPp(shortTermAccelerationPp)} from 1Q to 1W.${Number.isFinite(oneWeekVsBaselinePp) && Number.isFinite(oneMonthVsBaselinePp) ? ` Vs ${baselineTicker}: 1W ${fmtPp(oneWeekVsBaselinePp)}, 1M ${fmtPp(oneMonthVsBaselinePp)}.` : ''}`,
      })
    } else if (returns['1W'] < returns['1M'] && returns['1M'] < returns['1Q']) {
      const shortTermFadePp = (returns['1W'] - returns['1Q']) * 100
      const oneWeekVsBaselinePp = rel[0] * 100
      const oneMonthVsBaselinePp = rel[1] * 100
      trendFlags.push({
        ticker,
        signal: 'Momentum Deteriorating',
        details: `1W ${fmtPct(returns['1W'])}, 1M ${fmtPct(returns['1M'])}, 1Q ${fmtPct(returns['1Q'])}. Short-term fade: ${fmtPp(shortTermFadePp)} from 1Q to 1W.${Number.isFinite(oneWeekVsBaselinePp) && Number.isFinite(oneMonthVsBaselinePp) ? ` Vs ${baselineTicker}: 1W ${fmtPp(oneWeekVsBaselinePp)}, 1M ${fmtPp(oneMonthVsBaselinePp)}.` : ''}`,
      })
    }
  })

  const rotationSignals: string[] = []
  const iwm = data.IWM?.returns
  const qqq = data.QQQ?.returns
  if (iwm && qqq && typeof iwm['1W'] === 'number' && typeof iwm['1Q'] === 'number' && typeof qqq['1W'] === 'number' && typeof qqq['1Q'] === 'number') {
    if (iwm['1W'] > qqq['1W'] && iwm['1Q'] < qqq['1Q']) {
      rotationSignals.push('Small-caps are starting to outperform in the short term (IWM > QQQ on 1W while still trailing on 1Q).')
    }
  }

  const cyclical = ['XLK', 'XLI', 'XLF', 'XLY']
  const defensive = ['XLU', 'XLV', 'XLP']
  const cyclical1W = average(cyclical.map((ticker) => data[ticker]?.returns?.['1W']).filter((v): v is number => typeof v === 'number'))
  const cyclical1Q = average(cyclical.map((ticker) => data[ticker]?.returns?.['1Q']).filter((v): v is number => typeof v === 'number'))
  const defensive1W = average(defensive.map((ticker) => data[ticker]?.returns?.['1W']).filter((v): v is number => typeof v === 'number'))
  const defensive1Q = average(defensive.map((ticker) => data[ticker]?.returns?.['1Q']).filter((v): v is number => typeof v === 'number'))
  if (defensive1W > cyclical1W && defensive1Q < cyclical1Q) {
    rotationSignals.push('Defensive sectors are improving on 1W relative to cyclicals, suggesting an early risk-off rotation.')
  } else if (cyclical1W > defensive1W && cyclical1Q < defensive1Q) {
    rotationSignals.push('Cyclicals are improving on 1W relative to defensives, suggesting a possible risk-on rotation.')
  }

  if (rotationSignals.length === 0) {
    rotationSignals.push('No strong early sector-rotation trigger detected from current 1W/1M/1Q relationships.')
  }

  const summary: string[] = []
  if (top3.length > 0) {
    summary.push(`Top 1Q leaders: ${top3.map((item) => `${item.ticker} ${item.value >= 0 ? '+' : ''}${(item.value * 100).toFixed(2)}%`).join(', ')}.`)
  }
  if (bottom3.length > 0) {
    summary.push(`Bottom 1Q laggards: ${bottom3.map((item) => `${item.ticker} ${item.value >= 0 ? '+' : ''}${(item.value * 100).toFixed(2)}%`).join(', ')}.`)
  }
  if (baselineReturns && typeof baselineReturns['1Q'] === 'number') {
    summary.push(`${baselineTicker} baseline: ${baselineReturns['1Q'] >= 0 ? '+' : ''}${(baselineReturns['1Q'] * 100).toFixed(2)}% on 1Q.`)
  }
  summary.push(`Trend flags raised: ${trendFlags.length}. Rotation signals: ${rotationSignals.length}.`)

  return {
    summary,
    trendFlags: trendFlags.slice(0, 12),
    rotationSignals,
  }
}

const buildComparison = (
  currentData: SummaryData,
  compareData: SummaryData,
  periods: string[],
  baseDate: string,
  compareDate: string
) => {
  const comparison: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }> = {}
  Object.keys(currentData).forEach((ticker) => {
    const current = currentData[ticker]?.returns || {}
    const baseline = compareData[ticker]?.returns || {}
    const deltas: Record<string, number> = {}
    periods.forEach((period) => {
      const currentValue = current[period]
      const baselineValue = baseline[period]
      if (typeof currentValue === 'number' && typeof baselineValue === 'number') {
        deltas[period] = currentValue - baselineValue
      }
    })
    if (Object.keys(deltas).length > 0) {
      comparison[ticker] = {
        periods: deltas,
        baseScanDate: baseDate,
        compareScanDate: compareDate,
      }
    }
  })
  return comparison
}

const buildSummaryAtDate = async (
  tickers: string[],
  viewMode: string,
  normalizationTicker: string | null,
  endDate: Date
) => {
  const maxLookback = Math.max(...Object.values(PERIOD_DAYS))
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (maxLookback + 5))

  const fetchTickers = normalizationTicker
    ? Array.from(new Set([...tickers, normalizationTicker]))
    : tickers

  const results = await Promise.all(
    fetchTickers.map(async (ticker) => {
      try {
        return {
          ticker,
          series: await fetchSeries(ticker, startDate, endDate),
          error: '',
        }
      } catch (err) {
        return {
          ticker,
          series: [] as HistoricalPoint[],
          error: err instanceof Error ? err.message : 'Failed to fetch data',
        }
      }
    })
  )

  const data: SummaryData = {}
  const failures: string[] = []
  const normalizationSeries = normalizationTicker ? results.find((result) => result.ticker === normalizationTicker)?.series || [] : []
  const normalizationMap = new Map(normalizationSeries.map((point) => [formatDate(point.date), point.close]))
  let benchmarkReturns: Record<string, number> | null = null

  const computeRelativeReturn = (series: HistoricalPoint[], periodStart: Date): number => {
    if (series.length < 2 || normalizationSeries.length < 2) {
      return 0
    }
    const startPoint = series.find((point) => point.date >= periodStart)
    const endPoint = series[series.length - 1]
    if (!startPoint || !endPoint) {
      return 0
    }
    const startKey = formatDate(startPoint.date)
    const endKey = formatDate(endPoint.date)
    const normStart = normalizationMap.get(startKey)
    const normEnd = normalizationMap.get(endKey)
    if (!normStart || !normEnd || normStart === 0) {
      return 0
    }
    const baseRatio = startPoint.close / normStart
    const endRatio = endPoint.close / normEnd
    return endRatio / baseRatio - 1
  }

  results.forEach((result) => {
    if (result.error) {
      failures.push(`${result.ticker}: ${result.error}`)
    }
    if (normalizationTicker && result.ticker === normalizationTicker) {
      const benchmarkPeriodReturns: Record<string, number> = {}
      Object.entries(PERIOD_DAYS).forEach(([period, days]) => {
        const periodStart = new Date(endDate)
        periodStart.setDate(periodStart.getDate() - days)
        benchmarkPeriodReturns[period] = computeReturn(result.series, periodStart)
      })
      benchmarkReturns = benchmarkPeriodReturns
      return
    }
    const series = result.series
    if (series.length < 2) {
      return
    }
    const lastDate = formatDate(series[series.length - 1].date)
    const returns: Record<string, number> = {}
    Object.entries(PERIOD_DAYS).forEach(([period, days]) => {
      const periodStart = new Date(endDate)
      periodStart.setDate(periodStart.getDate() - days)
      returns[period] = viewMode === 'relative'
        ? computeRelativeReturn(series, periodStart)
        : computeReturn(series, periodStart)
    })
    data[result.ticker] = { returns, lastDate }
  })

  return {
    data,
    failures,
    periods: Object.keys(PERIOD_DAYS),
    benchmarkReturns,
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const tickersParam = searchParams.get('tickers')
    const viewMode = String(searchParams.get('viewMode') || 'absolute').toLowerCase()
    const normalizationTickerRaw = searchParams.get('normalizationTicker')
    const normalizationTicker = normalizationTickerRaw ? normalizationTickerRaw.trim().toUpperCase() : null
    const asOfDateParam = searchParams.get('asOfDate')
    const compareAsOfDateParam = searchParams.get('compareAsOfDate')
    const tickers = tickersParam
      ? tickersParam.split(',').map((ticker) => ticker.trim()).filter(Boolean)
      : []

    if (tickers.length === 0) {
      return NextResponse.json({ error: 'Tickers are required' }, { status: 400 })
    }
    if (viewMode === 'relative' && !normalizationTicker) {
      return NextResponse.json({ error: 'Normalization ticker is required for relative view' }, { status: 400 })
    }

    const asOfDate = parseDateParam(asOfDateParam) || new Date()
    if (asOfDateParam && !parseDateParam(asOfDateParam)) {
      return NextResponse.json({ error: 'Invalid asOfDate format. Use YYYY-MM-DD.' }, { status: 400 })
    }
    const compareAsOfDate = parseDateParam(compareAsOfDateParam)
    if (compareAsOfDateParam && !compareAsOfDate) {
      return NextResponse.json({ error: 'Invalid compareAsOfDate format. Use YYYY-MM-DD.' }, { status: 400 })
    }

    const summary = await buildSummaryAtDate(tickers, viewMode, normalizationTicker, asOfDate)
    const analysisBenchmarkTicker = normalizationTicker || 'SPY'
    const analysis = buildAutomatedAnalysis(summary.data, viewMode, analysisBenchmarkTicker, summary.benchmarkReturns)
    let comparison: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }> = {}
    if (compareAsOfDate) {
      const compareSummary = await buildSummaryAtDate(tickers, viewMode, normalizationTicker, compareAsOfDate)
      comparison = buildComparison(
        summary.data,
        compareSummary.data,
        summary.periods,
        formatDate(asOfDate),
        formatDate(compareAsOfDate)
      )
    }

    return NextResponse.json({
      tickers: summary.data,
      periods: summary.periods,
      asOf: formatDate(asOfDate),
      viewMode,
      normalizationTicker: normalizationTicker || null,
      errors: summary.failures,
      source: 'live',
      analysis,
      comparison,
      compareAsOfDate: compareAsOfDate ? formatDate(compareAsOfDate) : null,
    })
  } catch (error) {
    console.error('Performance summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
