import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
const yahooFinance = new YahooFinance({ suppressNotices: ['ripHistorical'] })

const SECTOR_TICKERS = ['XLK', 'XLI', 'XLF', 'XLE', 'XLY', 'XLP', 'XLV', 'XLU', 'XLB', 'XLRE', 'SMH', 'IWM', 'DIA', 'SPMD', 'SPY']
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

const computeReturn = (series: HistoricalPoint[], startDate: Date): { value: number; date: string } => {
  if (series.length < 2) {
    return { value: 0, date: '' }
  }
  const startPoint = series.find((point) => point.date >= startDate)
  const endPoint = series[series.length - 1]
  if (!startPoint || !endPoint || startPoint.close === 0) {
    return { value: 0, date: formatDate(endPoint.date) }
  }
  return { value: endPoint.close / startPoint.close - 1, date: formatDate(endPoint.date) }
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const token = searchParams.get('token')
    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const watchListParam = searchParams.get('watchList')
    const watchList = watchListParam
      ? watchListParam.split(',').map((ticker) => ticker.trim()).filter(Boolean)
      : []
    const tickers = Array.from(new Set([...SECTOR_TICKERS, ...watchList]))

    const endDate = new Date()
    const maxLookback = Math.max(...Object.values(PERIOD_DAYS))
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (maxLookback + 5))

    const results = await Promise.all(
      tickers.map(async (ticker) => ({
        ticker,
        series: await fetchSeries(ticker, startDate, endDate),
      }))
    )

    const scan: Record<string, any> = {}
    Object.entries(PERIOD_DAYS).forEach(([period, days]) => {
      const periodStart = new Date(endDate)
      periodStart.setDate(periodStart.getDate() - days)
      const periodResults = results
        .map((result) => {
          const { value, date } = computeReturn(result.series, periodStart)
          const lastPrice = result.series.length ? result.series[result.series.length - 1].close : 0
          return { ticker: result.ticker, return: value, price: lastPrice, date }
        })
        .filter((row) => Number.isFinite(row.return))
      const sorted = [...periodResults].sort((a, b) => b.return - a.return)
      scan[period] = {
        leaders: sorted.slice(0, 3),
        laggards: sorted.slice(-3).reverse(),
        all: periodResults,
      }
    })

    const asOf = formatDate(endDate)
    const payload = {
      asOf,
      periods: Object.keys(PERIOD_DAYS),
      sectors: SECTOR_TICKERS,
      watchList,
      results: scan,
    }

    const blob = await put(`dailyscan-${asOf}.json`, JSON.stringify(payload), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    })

    return NextResponse.json({ ok: true, blobUrl: blob.url, payload })
  } catch (error) {
    console.error('Daily scan error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
