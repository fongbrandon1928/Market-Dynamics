import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const SECTOR_TICKERS = ['QQQ', 'DIA', 'SPY', 'SPMD', 'IWM', 'XLF', 'XLE', 'XLK', 'XLC', 'XLP', 'XLU', 'XLV', 'XLI', 'SMH', 'XLB', 'XLRE', 'XLY']
const OFFENSIVE = ['XLK', 'XLY', 'XLI', 'XLF', 'SMH', 'IWM', 'QQQ']
const DEFENSIVE = ['XLP', 'XLU', 'XLV']

type PricePoint = {
  date: string
  close: number
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

const mean = (values: number[]): number => {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

const fetchSeries = async (ticker: string, startDate: Date, endDate: Date): Promise<PricePoint[]> => {
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
      date: formatDate(row.date as Date),
      close: row.close as number,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

const returnOverDays = (series: PricePoint[], lookbackDays: number): number => {
  if (series.length < 2) {
    return 0
  }
  const end = series[series.length - 1]
  const startIdx = Math.max(0, series.length - 1 - lookbackDays)
  const start = series[startIdx]
  if (!start || start.close === 0) {
    return 0
  }
  return end.close / start.close - 1
}

const movingAverage = (series: PricePoint[], window: number): number => {
  if (series.length < window) {
    return Number.NaN
  }
  const slice = series.slice(-window)
  return slice.reduce((sum, point) => sum + point.close, 0) / window
}

const movingAverageAtOffset = (series: PricePoint[], window: number, offset: number): number => {
  const end = series.length - offset
  const start = end - window
  if (start < 0 || end > series.length || start >= end) {
    return Number.NaN
  }
  const slice = series.slice(start, end)
  return slice.reduce((sum, point) => sum + point.close, 0) / window
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const params = request.nextUrl.searchParams
    const toParam = params.get('to')
    const lookbackDays = Number(params.get('lookbackDays') || 180)
    const toDate = toParam ? new Date(`${toParam}T23:59:59.999Z`) : new Date()
    if (Number.isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid to date' }, { status: 400 })
    }
    const fromDate = new Date(toDate)
    fromDate.setDate(fromDate.getDate() - lookbackDays)

    const tickers = Array.from(new Set([...SECTOR_TICKERS, 'SPY']))
    const results = await Promise.allSettled(
      tickers.map(async (ticker) => ({ ticker, series: await fetchSeries(ticker, fromDate, toDate) }))
    )

    const dataByTicker = new Map<string, PricePoint[]>()
    const warnings: string[] = []
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        dataByTicker.set(result.value.ticker, result.value.series)
      } else {
        warnings.push(String(result.reason))
      }
    })

    const spySeries = dataByTicker.get('SPY') || []
    if (spySeries.length < 2) {
      return NextResponse.json({ error: 'Not enough SPY data', warnings }, { status: 400 })
    }

    const metrics = SECTOR_TICKERS
      .map((ticker) => {
        const series = dataByTicker.get(ticker) || []
        if (series.length < 2) {
          return null
        }
        const r1w = returnOverDays(series, 5)
        const r1m = returnOverDays(series, 21)
        const r1q = returnOverDays(series, 63)
        const spy1w = returnOverDays(spySeries, 5)
        const spy1m = returnOverDays(spySeries, 21)
        const spy1q = returnOverDays(spySeries, 63)
        const rs1w = r1w - spy1w
        const rs1m = r1m - spy1m
        const rs1q = r1q - spy1q
        const accel = r1w - r1m
        const ma20 = movingAverage(series, 20)
        const ma63 = movingAverage(series, 63)
        const prevMa20 = movingAverageAtOffset(series, 20, 1)
        const prevMa63 = movingAverageAtOffset(series, 63, 1)
        const maSpread = Number.isFinite(ma20) && Number.isFinite(ma63) ? ma20 / ma63 - 1 : 0
        const maSignal = Number.isFinite(ma20) && Number.isFinite(ma63)
          ? ma20 > ma63
            ? 'bullish'
            : 'bearish'
          : 'neutral'
        const crossover = Number.isFinite(prevMa20) && Number.isFinite(prevMa63) && Number.isFinite(ma20) && Number.isFinite(ma63)
          ? prevMa20 <= prevMa63 && ma20 > ma63
            ? 'bullish_cross'
            : prevMa20 >= prevMa63 && ma20 < ma63
              ? 'bearish_cross'
              : 'none'
          : 'none'
        return {
          ticker,
          r1w,
          r1m,
          r1q,
          rs1w,
          rs1m,
          rs1q,
          accel,
          ma20,
          ma63,
          maSpread,
          maSignal,
          crossover,
        }
      })
      .filter((item): item is NonNullable<typeof item> => !!item)

    const rank1w = [...metrics].sort((a, b) => b.rs1w - a.rs1w)
    const rank1m = [...metrics].sort((a, b) => b.rs1m - a.rs1m)
    const rankShift = rank1w.map((row, idx) => {
      const monthIdx = rank1m.findIndex((item) => item.ticker === row.ticker)
      const previous = monthIdx >= 0 ? rank1m[monthIdx] : null
      return {
        ticker: row.ticker,
        currentRank: idx + 1,
        previousRank: monthIdx + 1,
        shift: (monthIdx + 1) - (idx + 1),
        currentRs1w: row.rs1w,
        previousRs1m: previous?.rs1m ?? 0,
      }
    })

    const topImprovers = [...rankShift].sort((a, b) => b.shift - a.shift).slice(0, 5)
    const topDecliners = [...rankShift].sort((a, b) => a.shift - b.shift).slice(0, 5)

    const offensive1w = mean(OFFENSIVE.map((ticker) => metrics.find((m) => m.ticker === ticker)?.r1w).filter((v): v is number => typeof v === 'number'))
    const defensive1w = mean(DEFENSIVE.map((ticker) => metrics.find((m) => m.ticker === ticker)?.r1w).filter((v): v is number => typeof v === 'number'))
    const offensive1m = mean(OFFENSIVE.map((ticker) => metrics.find((m) => m.ticker === ticker)?.r1m).filter((v): v is number => typeof v === 'number'))
    const defensive1m = mean(DEFENSIVE.map((ticker) => metrics.find((m) => m.ticker === ticker)?.r1m).filter((v): v is number => typeof v === 'number'))

    const dispersion1w = rank1w.length ? rank1w[0].r1w - rank1w[rank1w.length - 1].r1w : 0
    const leaders = rank1w.slice(0, 5)
    const laggards = [...rank1w].reverse().slice(0, 5).reverse()

    const rotationSignals: string[] = []
    const iwm = metrics.find((m) => m.ticker === 'IWM')
    const qqq = metrics.find((m) => m.ticker === 'QQQ')
    if (iwm && qqq && iwm.r1w > qqq.r1w && iwm.r1q < qqq.r1q) {
      rotationSignals.push('Small-caps show early catch-up: IWM outperforming QQQ on 1W while still trailing on 1Q.')
    }
    if (defensive1w > offensive1w && defensive1m < offensive1m) {
      rotationSignals.push('Defensive sectors improving short-term vs offensive groups (possible risk-off rotation).')
    }
    if (topImprovers.some((item) => OFFENSIVE.includes(item.ticker)) && topDecliners.some((item) => DEFENSIVE.includes(item.ticker))) {
      rotationSignals.push('Rank shift suggests rotation into offensive sectors.')
    }
    if (rotationSignals.length === 0) {
      rotationSignals.push('No strong early-rotation trigger from current indicator thresholds.')
    }

    const movingAverageSignals = [...metrics]
      .map((item) => ({
        ticker: item.ticker,
        ma20: item.ma20,
        ma63: item.ma63,
        spread: item.maSpread,
        signal: item.maSignal,
        crossover: item.crossover,
      }))
      .sort((a, b) => b.spread - a.spread)

    const bullishCrossovers = movingAverageSignals.filter((item) => item.crossover === 'bullish_cross').map((item) => item.ticker)
    const bearishCrossovers = movingAverageSignals.filter((item) => item.crossover === 'bearish_cross').map((item) => item.ticker)
    if (bullishCrossovers.length > 0) {
      rotationSignals.push(`20D MA crossed above 3M MA: ${bullishCrossovers.join(', ')}.`)
    }
    if (bearishCrossovers.length > 0) {
      rotationSignals.push(`20D MA crossed below 3M MA: ${bearishCrossovers.join(', ')}.`)
    }

    return NextResponse.json({
      asOf: formatDate(toDate),
      benchmark: 'SPY',
      warnings,
      trend: { leaders, laggards },
      relativeStrength: [...metrics].sort((a, b) => b.rs1m - a.rs1m).slice(0, 10),
      rankChanges: { fullRankList: rankShift, topImprovers, topDecliners },
      offenseDefense: {
        offensive1w,
        defensive1w,
        spread1w: offensive1w - defensive1w,
        offensive1m,
        defensive1m,
        spread1m: offensive1m - defensive1m,
      },
      momentum: {
        strongestAcceleration: [...metrics].sort((a, b) => b.accel - a.accel).slice(0, 5),
        weakestAcceleration: [...metrics].sort((a, b) => a.accel - b.accel).slice(0, 5),
      },
      movingAverages: {
        leadersBySpread: movingAverageSignals.slice(0, 5),
        laggardsBySpread: [...movingAverageSignals].reverse().slice(0, 5).reverse(),
        bullishCrossovers,
        bearishCrossovers,
      },
      dispersion: {
        oneWeekSpread: dispersion1w,
      },
      rotationSignals,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
