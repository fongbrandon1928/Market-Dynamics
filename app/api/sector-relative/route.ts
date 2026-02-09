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

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

type HistoricalPoint = {
  date: Date
  close: number
}

const fetchSeries = async (ticker: string, period: string): Promise<HistoricalPoint[]> => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - PERIOD_DAYS[period])
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

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const ticker = searchParams.get('ticker')
    const period = (searchParams.get('period') || '1D').toUpperCase()

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
    }
    if (!PERIOD_DAYS[period]) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
    }

    const sectorSeries = await fetchSeries(ticker, period)

    if (sectorSeries.length < 2) {
      return NextResponse.json({ error: 'Not enough data to calculate scaled price' }, { status: 400 })
    }

    const seriesForPeriod = period === '1D' ? sectorSeries.slice(-2) : sectorSeries
    if (seriesForPeriod.length < 2) {
      return NextResponse.json({ error: 'Not enough data to calculate scaled price' }, { status: 400 })
    }

    const aligned = seriesForPeriod.map((point) => ({
      date: formatDate(point.date),
      close: point.close,
    }))

    const base = aligned[0].close
    if (!Number.isFinite(base) || base === 0) {
      return NextResponse.json({ error: 'Invalid base price' }, { status: 400 })
    }

    const scaled = aligned.map((point) => ({
      date: point.date,
      value: (point.close / base) * 100,
    }))
    const last = scaled[scaled.length - 1]
    const baseValue = scaled[0].value
    const change = baseValue === 0 ? 0 : last.value / baseValue - 1

    return NextResponse.json({
      ticker,
      value: last.value,
      date: last.date,
      baseDate: scaled[0].date,
      change,
      period,
    })
  } catch (error) {
    console.error('Sector relative error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
