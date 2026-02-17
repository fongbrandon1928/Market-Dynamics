import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const PERIOD_DAYS: Record<string, number> = {
  '1D': 8,
  '1W': 8,
  '1M': 32,
  '1Q': 93,
  '1Y': 370,
  '2Y': 740,
  '5Y': 1850,
}

const YIELD_TICKERS = {
  tenYear: '^TNX',
  threeMonth: '^IRX',
}

const CYCLICAL_SECTORS = ['XLK', 'XLI', 'XLF', 'XLE', 'XLY', 'SMH', 'QQQ', 'IWM', 'DIA', 'SPMD']
const DEFENSIVE_SECTORS = ['XLU', 'XLV', 'XLP']
const PHASE_GROUPS: Record<string, string[]> = {
  early: ['XLY', 'XLF', 'XLI', 'XLK'],
  mid: ['XLE', 'XLB'],
  late: ['XLV', 'XLP', 'XLU'],
  recession: ['XLU', 'XLP', 'XLV'],
}

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

type HistoricalPoint = {
  date: Date
  close: number
}

type RrgQuadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving'

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length
const std = (values: number[], meanValue: number): number => {
  if (values.length <= 1) {
    return Number.NaN
  }
  const variance = values.reduce((sum, v) => sum + Math.pow(v - meanValue, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

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

const getWeekKey = (date: Date): string => {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

const toWeeklyCloses = (series: HistoricalPoint[]) => {
  const weeklyMap = new Map<string, HistoricalPoint>()
  series.forEach((point) => {
    const key = getWeekKey(point.date)
    const existing = weeklyMap.get(key)
    if (!existing || point.date.getTime() >= existing.date.getTime()) {
      weeklyMap.set(key, point)
    }
  })
  return Array.from(weeklyMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
}

const computeSma = (values: number[], window: number): number => {
  if (values.length < window) {
    return Number.NaN
  }
  const slice = values.slice(-window)
  return mean(slice)
}

const alignSeries = (sector: HistoricalPoint[], spy: HistoricalPoint[]) => {
  const spyMap = new Map(spy.map((point) => [formatDate(point.date), point.close]))
  return sector
    .map((point) => {
      const dateKey = formatDate(point.date)
      const spyClose = spyMap.get(dateKey)
      if (!spyClose) {
        return null
      }
      return {
        date: dateKey,
        sectorClose: point.close,
        spyClose,
        rsRatio: point.close / spyClose,
      }
    })
    .filter((point): point is { date: string; sectorClose: number; spyClose: number; rsRatio: number } => !!point)
}

const computeReturn = (series: { date: string; value: number }[], startKey: string): number => {
  const startPoint = series.find((point) => point.date >= startKey)
  const endPoint = series[series.length - 1]
  if (!startPoint || !endPoint || startPoint.value === 0) {
    return 0
  }
  return endPoint.value / startPoint.value - 1
}

const getQuadrant = (rsIndex: number, momentum: number): RrgQuadrant => {
  if (rsIndex >= 100 && momentum >= 0) {
    return 'Leading'
  }
  if (rsIndex >= 100 && momentum < 0) {
    return 'Weakening'
  }
  if (rsIndex < 100 && momentum >= 0) {
    return 'Improving'
  }
  return 'Lagging'
}

const computeGroupStrength = (tickers: string[], metrics: Record<string, any>) => {
  const values = tickers
    .map((ticker) => metrics[ticker]?.rsIndex)
    .filter((value) => typeof value === 'number') as number[]
  if (values.length === 0) {
    return 0
  }
  return mean(values)
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const period = (searchParams.get('period') || '1D').toUpperCase()
    const tickersParam = searchParams.get('tickers')
    const tickers = tickersParam
      ? tickersParam.split(',').map((ticker) => ticker.trim()).filter(Boolean)
      : []

    if (!PERIOD_DAYS[period]) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }
    if (tickers.length === 0) {
      return NextResponse.json({ error: 'Tickers are required' }, { status: 400 })
    }

    const endDate = new Date()
    const periodStart = new Date()
    periodStart.setDate(endDate.getDate() - PERIOD_DAYS[period])

    const lookbackDays = Math.max(PERIOD_DAYS[period], 120)
    const fetchStart = new Date(endDate)
    fetchStart.setDate(fetchStart.getDate() - lookbackDays)

    const [spySeries, tenYearSeries, threeMonthSeries, ...sectorSeries] = await Promise.all([
      fetchSeries('SPY', fetchStart, endDate),
      fetchSeries(YIELD_TICKERS.tenYear, fetchStart, endDate),
      fetchSeries(YIELD_TICKERS.threeMonth, fetchStart, endDate),
      ...tickers.map((ticker) => fetchSeries(ticker, fetchStart, endDate)),
    ])

    if (spySeries.length < 2) {
      return NextResponse.json({ error: 'Not enough SPY data to calculate relative strength' }, { status: 400 })
    }

    const periodStartKey = formatDate(periodStart)
    const sectorMetrics: Record<string, any> = {}
    const periodReturns: number[] = []
    const above40: string[] = []
    const below40: string[] = []
    const breakAbove40: string[] = []
    const breakBelow40: string[] = []

    tickers.forEach((ticker, index) => {
      const series = sectorSeries[index] || []
      if (series.length < 2) {
        return
      }

      const aligned = alignSeries(series, spySeries)
      if (aligned.length < 2) {
        return
      }

      const rsSeries = aligned.map((point) => ({
        date: point.date,
        value: point.rsRatio,
      }))
      const rsIndex = (rsSeries[rsSeries.length - 1].value / rsSeries[0].value) * 100

      const momentumShort = Math.min(5, rsSeries.length - 1)
      const momentumLong = Math.min(20, rsSeries.length - 1)
      const shortBase = rsSeries[rsSeries.length - 1 - momentumShort]?.value
      const longBase = rsSeries[rsSeries.length - 1 - momentumLong]?.value
      const shortReturn = shortBase ? rsSeries[rsSeries.length - 1].value / shortBase - 1 : 0
      const longReturn = longBase ? rsSeries[rsSeries.length - 1].value / longBase - 1 : 0
      const rsMomentum = shortReturn - longReturn

      const priceSeries = series.map((point) => ({ date: formatDate(point.date), value: point.close }))
      const periodReturn = computeReturn(priceSeries, periodStartKey)
      periodReturns.push(periodReturn)

      const lastClose = priceSeries[priceSeries.length - 1].value
      const ma20Values = priceSeries.slice(-20).map((point) => point.value)
      const ma50Values = priceSeries.slice(-50).map((point) => point.value)
      const ma20 = ma20Values.length === 20 ? mean(ma20Values) : Number.NaN
      const ma50 = ma50Values.length === 50 ? mean(ma50Values) : Number.NaN

      const weeklySeries = toWeeklyCloses(series)
      const weeklyCloses = weeklySeries.map((point) => point.close)
      const weeklySma18 = computeSma(weeklyCloses, 18)
      const weeklySma40 = computeSma(weeklyCloses, 40)
      const prevWeeklySma40 = weeklyCloses.length > 40 ? mean(weeklyCloses.slice(-41, -1)) : Number.NaN
      const lastWeeklyClose = weeklyCloses[weeklyCloses.length - 1]
      const prevWeeklyClose = weeklyCloses[weeklyCloses.length - 2]

      const isAbove40 = Number.isFinite(weeklySma40) && lastWeeklyClose > weeklySma40
      const isBelow40 = Number.isFinite(weeklySma40) && lastWeeklyClose < weeklySma40
      if (isAbove40) {
        above40.push(ticker)
      }
      if (isBelow40) {
        below40.push(ticker)
      }
      const crossedAbove = Number.isFinite(prevWeeklySma40)
        && prevWeeklyClose <= prevWeeklySma40
        && lastWeeklyClose > weeklySma40
      const crossedBelow = Number.isFinite(prevWeeklySma40)
        && prevWeeklyClose >= prevWeeklySma40
        && lastWeeklyClose < weeklySma40
      if (crossedAbove) {
        breakAbove40.push(ticker)
      }
      if (crossedBelow) {
        breakBelow40.push(ticker)
      }

      const returnSeries = []
      for (let i = 1; i < priceSeries.length; i += 1) {
        const prev = priceSeries[i - 1].value
        const curr = priceSeries[i].value
        if (prev === 0) {
          continue
        }
        returnSeries.push(curr / prev - 1)
      }
      const recentReturns = returnSeries.slice(-20)
      const vol = recentReturns.length > 1 ? std(recentReturns, mean(recentReturns)) : Number.NaN

      sectorMetrics[ticker] = {
        periodReturn,
        rsIndex,
        rsMomentum,
        quadrant: getQuadrant(rsIndex, rsMomentum),
        belowMA20: Number.isFinite(ma20) ? lastClose < ma20 : false,
        belowMA50: Number.isFinite(ma50) ? lastClose < ma50 : false,
        weeklySma18,
        weeklySma40,
        aboveWeekly40: isAbove40,
        belowWeekly40: isBelow40,
        volatility: Number.isFinite(vol) ? vol : 0,
      }
    })

    const cyclicalReturns = CYCLICAL_SECTORS
      .map((ticker) => sectorMetrics[ticker]?.periodReturn)
      .filter((value) => typeof value === 'number') as number[]
    const defensiveReturns = DEFENSIVE_SECTORS
      .map((ticker) => sectorMetrics[ticker]?.periodReturn)
      .filter((value) => typeof value === 'number') as number[]

    const cyclicalAvg = cyclicalReturns.length ? mean(cyclicalReturns) : 0
    const defensiveAvg = defensiveReturns.length ? mean(defensiveReturns) : 0
    const offenseDefensiveSpread = cyclicalAvg - defensiveAvg
    const riskOff = defensiveAvg > cyclicalAvg + 0.5 / 100

    const tenYear = tenYearSeries.length ? tenYearSeries[tenYearSeries.length - 1].close : 0
    const threeMonth = threeMonthSeries.length ? threeMonthSeries[threeMonthSeries.length - 1].close : 0
    const curveSpread = tenYear - threeMonth
    const curveInverted = curveSpread < 0

    const tenYearSeriesMapped = tenYearSeries.map((point) => ({
      date: formatDate(point.date),
      value: point.close,
    }))
    const rateChange = computeReturn(tenYearSeriesMapped, periodStartKey)

    const returnsSorted = [...periodReturns].sort((a, b) => a - b)
    const maxReturn = returnsSorted[returnsSorted.length - 1] ?? 0
    const minReturn = returnsSorted[0] ?? 0
    const dispersion = maxReturn - minReturn
    const rotationDetected = dispersion >= 0.05 && (riskOff || curveInverted)

    const groupStrength = {
      early: computeGroupStrength(PHASE_GROUPS.early, sectorMetrics),
      mid: computeGroupStrength(PHASE_GROUPS.mid, sectorMetrics),
      late: computeGroupStrength(PHASE_GROUPS.late, sectorMetrics),
      recession: computeGroupStrength(PHASE_GROUPS.recession, sectorMetrics),
    }
    const orderedGroups = Object.entries(groupStrength).sort((a, b) => b[1] - a[1])
    let cyclePhase = orderedGroups.length ? orderedGroups[0][0] : 'unknown'
    if (curveInverted || riskOff) {
      cyclePhase = groupStrength.recession >= groupStrength.late ? 'recession' : 'late'
    }

    return NextResponse.json({
      period,
      periodStart: periodStartKey,
      periodEnd: formatDate(endDate),
      rotationDetected,
      dispersion,
      cyclePhase,
      groupStrength,
      technicals: {
        above40,
        below40,
        breakAbove40,
        breakBelow40,
      },
      offenseDefensive: {
        cyclicalAvg,
        defensiveAvg,
        spread: offenseDefensiveSpread,
        riskOff,
      },
      yieldCurve: {
        tenYear,
        threeMonth,
        spread: curveSpread,
        inverted: curveInverted,
        rateChange,
      },
      sectors: sectorMetrics,
    })
  } catch (error) {
    console.error('Sector rotation error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
