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

    const fetchStart = new Date(requestedStart)

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

    const zscores: Record<string, number[]> = {}
    let dates: string[] = []
    let commonDates: string[] = []

    for (const ticker of normalizedTickers) {
      const tickerHistory = historyByTicker.get(ticker) || []
      if (tickerHistory.length === 0) {
        continue
      }

      const tickerDates = tickerHistory
        .map((point) => point.date)
        .filter((date) => date >= startDate && date <= endDate)

      if (tickerDates.length === 0) {
        continue
      }

      if (commonDates.length === 0) {
        commonDates = [...tickerDates]
      } else {
        const dateSet = new Set(tickerDates)
        commonDates = commonDates.filter((date) => dateSet.has(date))
      }
    }

    if (commonDates.length === 0) {
      return NextResponse.json({ error: 'Not enough overlapping data to calculate cumulative returns' }, { status: 400 })
    }

    for (const ticker of normalizedTickers) {
      const tickerHistory = historyByTicker.get(ticker) || []
      if (tickerHistory.length === 0) {
        continue
      }

      const tickerMap = new Map(tickerHistory.map((point) => [point.date, point.close]))
      const baseDate = commonDates[0]
      const baseClose = tickerMap.get(baseDate)
      if (!baseClose || baseClose === 0) {
        continue
      }

      const cumulative: number[] = []
      commonDates.forEach((date) => {
        const tickerClose = tickerMap.get(date)
        if (!tickerClose) {
          cumulative.push(0)
          return
        }
        cumulative.push(tickerClose / baseClose - 1)
      })

      zscores[ticker] = cumulative
    }

    dates = commonDates

    return NextResponse.json({ zscores, dates })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
