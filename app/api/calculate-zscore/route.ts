import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const WINDOW_BY_TIMESCALE: Record<string, number> = {
  '1M': 21,
  '6M': 126,
  '1Y': 252,
  '2Y': 504,
}

type PricePoint = {
  date: string
  close: number
}

type ReturnPoint = {
  date: string
  value: number
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

const computeReturns = (series: PricePoint[]): ReturnPoint[] => {
  if (series.length < 2) {
    return []
  }
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const returns: ReturnPoint[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1].close
    const curr = sorted[i].close
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) {
      continue
    }
    if (prev === 0) {
      continue
    }
    returns.push({
      date: sorted[i].date,
      value: curr / prev - 1,
    })
  }
  return returns
}

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length

const std = (values: number[], meanValue: number): number => {
  if (values.length <= 1) {
    return Number.NaN
  }
  const variance = values.reduce((sum, v) => sum + Math.pow(v - meanValue, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

const median = (values: number[]): number => {
  if (values.length === 0) {
    return Number.NaN
  }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

const quantile = (values: number[], q: number): number => {
  if (values.length === 0) {
    return Number.NaN
  }
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const lower = Math.floor(pos)
  const upper = Math.ceil(pos)
  if (lower === upper) {
    return sorted[lower]
  }
  const weight = pos - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

const computeRollingStats = (values: number[], window: number) => {
  const rollingMean: number[] = []
  const rollingStd: number[] = []
  const rollingMedian: number[] = []
  const rollingMad: number[] = []
  const rollingIqr: number[] = []
  const rollingMin: number[] = []
  const rollingMax: number[] = []
  const rollingRange: number[] = []

  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1)

    const sliceMean = mean(slice)
    const sliceMedian = median(slice)
    const sliceStd = std(slice, sliceMean)
    const absDeviations = slice.map((v) => Math.abs(v - sliceMedian))
    const sliceMad = median(absDeviations)
    const sliceQ1 = quantile(slice, 0.25)
    const sliceQ3 = quantile(slice, 0.75)
    const sliceIqr = sliceQ3 - sliceQ1
    const sliceMin = Math.min(...slice)
    const sliceMax = Math.max(...slice)
    const sliceRange = sliceMax - sliceMin

    rollingMean.push(sliceMean)
    rollingStd.push(sliceStd)
    rollingMedian.push(sliceMedian)
    rollingMad.push(sliceMad)
    rollingIqr.push(sliceIqr === 0 ? Number.NaN : sliceIqr)
    rollingMin.push(sliceMin)
    rollingMax.push(sliceMax)
    rollingRange.push(sliceRange === 0 ? Number.NaN : sliceRange)
  }

  return {
    rollingMean,
    rollingStd,
    rollingMedian,
    rollingMad,
    rollingIqr,
    rollingMin,
    rollingMax,
    rollingRange,
  }
}

const sanitizeScore = (value: number): number => (Number.isFinite(value) ? value : 0)
const isLowVol = (value: number): boolean => !Number.isFinite(value) || Math.abs(value) < 1e-12
const safeDivide = (numerator: number, denominator: number): number => {
  if (isLowVol(denominator)) {
    return 0
  }
  return numerator / denominator
}

const computeScore = (values: number[], window: number, metric: string): number[] => {
  const stats = computeRollingStats(values, window)
  return values.map((value, index) => {
    switch (metric) {
      case 'modified_zscore': {
        const denom = 1.4826 * stats.rollingMad[index]
        return sanitizeScore(
          safeDivide(value - stats.rollingMedian[index], denom)
        )
      }
      case 'iqr': {
        return sanitizeScore(
          safeDivide(value - stats.rollingMedian[index], stats.rollingIqr[index])
        )
      }
      case 'minmax': {
        return sanitizeScore(
          safeDivide(value - stats.rollingMin[index], stats.rollingRange[index])
        )
      }
      case 'zscore':
      default: {
        return sanitizeScore(
          safeDivide(value - stats.rollingMean[index], stats.rollingStd[index])
        )
      }
    }
  })
}

const fetchHistorical = async (ticker: string, startDate: Date, endDate: Date): Promise<PricePoint[]> => {
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
      date: formatDate(row.date),
      close: row.close as number,
    }))
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { tickers, normalizationTicker, startDate, endDate, timescale, metric } = body

    if (!tickers || !normalizationTicker || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const requestedStart = new Date(startDate)
    const requestedEnd = new Date(endDate)
    if (Number.isNaN(requestedStart.getTime()) || Number.isNaN(requestedEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const normalizedTickers = Array.from(
      new Set(
        [
          ...(Array.isArray(tickers) ? tickers : []),
          normalizationTicker,
        ]
          .map((ticker: string) => String(ticker).trim())
          .filter((ticker: string) => ticker.length > 0)
      )
    )

    if (normalizedTickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 })
    }

    const metricKey = String(metric || 'zscore').toLowerCase()
    const defaultStatsWindow = WINDOW_BY_TIMESCALE['2Y']
    const cutoffDate = new Date(requestedEnd)
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2)
    const cutoffKey = formatDate(cutoffDate)
    const fetchStart = cutoffDate

    const historyResults = await Promise.all(
      normalizedTickers.map(async (ticker: string) => ({
        ticker,
        data: await fetchHistorical(ticker, fetchStart, requestedEnd),
      }))
    )

    const historyByTicker = new Map<string, PricePoint[]>()
    for (const result of historyResults) {
      historyByTicker.set(result.ticker, result.data)
    }

    const normalizationHistory = historyByTicker.get(normalizationTicker) || []
    if (normalizationHistory.length === 0) {
      return NextResponse.json(
        { error: `Normalization ticker ${normalizationTicker} not found in data` },
        { status: 400 }
      )
    }

    const normReturns = computeReturns(normalizationHistory)
    const normReturnMap = new Map(normReturns.map((point) => [point.date, point.value]))

    const zscores: Record<string, number[]> = {}
    let dates: string[] = []

    for (const ticker of normalizedTickers) {
      const tickerHistory = historyByTicker.get(ticker) || []
      if (tickerHistory.length === 0) {
        continue
      }

      const tickerReturns = computeReturns(tickerHistory)
      const relativeReturns: ReturnPoint[] = []

      for (const point of tickerReturns) {
        const normReturn = normReturnMap.get(point.date)
        if (normReturn === undefined) {
          continue
        }
        relativeReturns.push({
          date: point.date,
          value: point.value - normReturn,
        })
      }

      if (relativeReturns.length === 0) {
        continue
      }

      const trailingCount = relativeReturns.reduce(
        (count, point) => (point.date >= cutoffKey ? count + 1 : count),
        0
      )
      const window = Math.min(
        trailingCount > 1 ? trailingCount : defaultStatsWindow,
        relativeReturns.length
      )
      const values = relativeReturns.map((point) => point.value)
      const score = computeScore(values, window, metricKey)
      const filtered: number[] = []
      const filteredDates: string[] = []
      for (let i = 0; i < relativeReturns.length; i += 1) {
        if (relativeReturns[i].date >= startDate) {
          filtered.push(Number.isFinite(score[i]) ? score[i] : 0)
          if (dates.length === 0) {
            filteredDates.push(relativeReturns[i].date)
          }
        }
      }
      zscores[ticker] = filtered

      if (dates.length === 0) {
        dates = filteredDates
      }
    }

    return NextResponse.json({ zscores, dates })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
