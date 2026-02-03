import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance()

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)
const PERIOD_DAYS: Record<string, number> = {
  '1D': 2,
  '1W': 8,
  '1M': 32,
  '1Q': 93,
}

type HistoricalPoint = {
  date: Date
  close: number | null
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

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - PERIOD_DAYS[period])

    const rows = await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Not enough data to calculate return' }, { status: 400 })
    }

    const points: HistoricalPoint[] = rows
      .filter((row) => row.date && typeof row.close === 'number')
      .map((row) => ({
        date: row.date as Date,
        close: row.close as number,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    if (points.length < 2) {
      return NextResponse.json({ error: 'Not enough data to calculate return' }, { status: 400 })
    }

    const last = points[points.length - 1]
    const first = points[0]

    if (!last.close || !first.close) {
      return NextResponse.json({ error: 'Invalid price data' }, { status: 400 })
    }

    const dailyReturn = last.close / first.close - 1

    return NextResponse.json({
      ticker,
      date: formatDate(last.date),
      period,
      dailyReturn,
    })
  } catch (error) {
    console.error('Sector return error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
