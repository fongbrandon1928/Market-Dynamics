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

const fetchSeries = async (ticker: string, startDate: Date, endDate: Date): Promise<HistoricalPoint[]> => {
  const rows = await yahooFinance.historical(ticker, {
    period1: startDate,
    period2: endDate,
    interval: '1d',
  })
  if (!rows || rows.length === 0) {
    return []
  }
  return rows
    .filter((row) => row.date && typeof row.close === 'number')
    .map((row) => ({
      close: row.close as number,
      date: row.date as Date,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
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

  const fetchTickers = viewMode === 'relative' && normalizationTicker
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
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const tickersParam = searchParams.get('tickers')
    const viewMode = String(searchParams.get('viewMode') || 'absolute').toLowerCase()
    const normalizationTicker = searchParams.get('normalizationTicker')
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
