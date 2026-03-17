import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const formatDate = (date: Date): string => date.toISOString().slice(0, 10)
const PERIOD_DAYS: Record<string, number> = {
  '1D': 8,
  '1W': 8,
  '1M': 32,
  '1Q': 93,
  '1Y': 370,
  '2Y': 740,
  '5Y': 1850,
}

type HistoricalPoint = {
  date: Date
  close: number | null
}

type LatestQuote = {
  price: number
  date: Date
} | null

const fetchHistoricalWithFallback = async (ticker: string, startDate: Date, endDate: Date) => {
  for (let dayOffset = 0; dayOffset <= 3; dayOffset += 1) {
    const queryEndDate = new Date(endDate)
    queryEndDate.setDate(queryEndDate.getDate() - dayOffset)
    try {
      return await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: queryEndDate,
        interval: '1d',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isNullValuesError = message.includes('SOME (but not all) null values')
      if (!isNullValuesError || dayOffset === 3) {
        throw error
      }
    }
  }
  return []
}

const fetchLatestQuote = async (ticker: string): Promise<LatestQuote> => {
  try {
    const quote = await yahooFinance.quote(ticker)
    const latestPrice = [quote.regularMarketPrice, quote.postMarketPrice, quote.preMarketPrice]
      .find((value): value is number => typeof value === 'number' && Number.isFinite(value))
    if (latestPrice === undefined) {
      return null
    }
    const latestTime = [quote.regularMarketTime, quote.postMarketTime, quote.preMarketTime]
      .find((value): value is number => typeof value === 'number' && Number.isFinite(value))
    return {
      price: latestPrice,
      date: latestTime ? new Date(latestTime * 1000) : new Date(),
    }
  } catch {
    return null
  }
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

    const rows = await fetchHistoricalWithFallback(ticker, startDate, endDate)

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
    const first = period === '1D' ? points[points.length - 2] : points[0]
    const latestQuote = await fetchLatestQuote(ticker)
    const latestPrice = latestQuote?.price ?? (last.close as number)
    const latestDate = latestQuote?.date ?? last.date

    if (!latestPrice || !first.close) {
      return NextResponse.json({ error: 'Invalid price data' }, { status: 400 })
    }

    const dailyReturn = latestPrice / first.close - 1

    return NextResponse.json({
      ticker,
      date: formatDate(latestDate),
      period,
      price: latestPrice,
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
