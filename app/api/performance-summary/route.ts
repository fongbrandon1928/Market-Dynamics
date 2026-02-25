import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
import { list } from '@vercel/blob'

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
type ScanPayload = {
  asOf?: string
  periods?: string[]
  results?: Record<string, { all?: Array<{ ticker: string; return: number; date: string }> }>
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

const parseScanPayload = (payload: ScanPayload, tickers: string[]) => {
  const periods = Array.isArray(payload.periods) && payload.periods.length > 0 ? payload.periods : Object.keys(PERIOD_DAYS)
  const data: SummaryData = {}
  tickers.forEach((ticker) => {
    const returns: Record<string, number> = {}
    let lastDate = payload.asOf || ''
    periods.forEach((period) => {
      const row = payload.results?.[period]?.all?.find((item) => item.ticker === ticker)
      if (row) {
        returns[period] = row.return
        if (row.date) {
          lastDate = row.date
        }
      }
    })
    if (Object.keys(returns).length > 0) {
      data[ticker] = { returns, lastDate }
    }
  })
  return { periods, data }
}

const buildComparison = (
  currentData: SummaryData,
  compareData: SummaryData,
  periods: string[],
  baseScanDate: string,
  compareScanDate: string
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
        baseScanDate,
        compareScanDate,
      }
    }
  })
  return comparison
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const tickersParam = searchParams.get('tickers')
    const viewMode = String(searchParams.get('viewMode') || 'absolute').toLowerCase()
    const normalizationTicker = searchParams.get('normalizationTicker')
    const scanDate = searchParams.get('scanDate') || 'live'
    const compareScanDate = searchParams.get('compareScanDate') || ''
    const tickers = tickersParam
      ? tickersParam.split(',').map((ticker) => ticker.trim()).filter(Boolean)
      : []

    if (tickers.length === 0) {
      return NextResponse.json({ error: 'Tickers are required' }, { status: 400 })
    }

    const blobs = await list({ prefix: 'dailyscan-' })
    const availableScanDates = blobs.blobs
      .map((blob) => {
        const match = blob.pathname.match(/^dailyscan-(\d{4}-\d{2}-\d{2})\.json$/)
        return match ? match[1] : null
      })
      .filter((value): value is string => !!value)
      .sort((a, b) => b.localeCompare(a))

    if (scanDate !== 'live') {
      if (viewMode === 'relative') {
        return NextResponse.json(
          { error: 'Historical scans are stored in absolute mode only', availableScanDates },
          { status: 400 }
        )
      }
      const targetPath = `dailyscan-${scanDate}.json`
      const targetBlob = blobs.blobs.find((blob) => blob.pathname === targetPath)
      if (!targetBlob) {
        return NextResponse.json(
          { error: `No historical scan found for ${scanDate}`, availableScanDates },
          { status: 404 }
        )
      }

      const token = process.env.BLOB_READ_WRITE_TOKEN
      const blobResponse = await fetch(targetBlob.url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!blobResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to load historical scan file', availableScanDates },
          { status: 500 }
        )
      }
      const payload = await blobResponse.json() as ScanPayload
      const { periods, data } = parseScanPayload(payload, tickers)
      let comparison: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }> = {}
      if (compareScanDate && compareScanDate !== scanDate) {
        const comparePath = `dailyscan-${compareScanDate}.json`
        const compareBlob = blobs.blobs.find((blob) => blob.pathname === comparePath)
        if (compareBlob) {
          const compareResponse = await fetch(compareBlob.url, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          })
          if (compareResponse.ok) {
            const comparePayload = await compareResponse.json() as ScanPayload
            const parsedCompare = parseScanPayload(comparePayload, tickers)
            comparison = buildComparison(data, parsedCompare.data, periods, scanDate, compareScanDate)
          }
        }
      }

      return NextResponse.json({
        tickers: data,
        periods,
        asOf: payload.asOf || scanDate,
        viewMode: 'absolute',
        normalizationTicker: null,
        errors: [],
        source: 'blob',
        scanDate,
        compareScanDate: compareScanDate || null,
        comparison,
        availableScanDates,
      })
    }

    const endDate = new Date()
    const maxLookback = Math.max(...Object.values(PERIOD_DAYS))
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - (maxLookback + 5))

    if (viewMode === 'relative' && !normalizationTicker) {
      return NextResponse.json({ error: 'Normalization ticker is required for relative view' }, { status: 400 })
    }

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

    const data: Record<string, { returns: Record<string, number>; lastDate: string }> = {}
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

    let comparison: Record<string, { periods: Record<string, number>; baseScanDate: string; compareScanDate: string }> = {}
    if (compareScanDate && compareScanDate !== 'live') {
      const comparePath = `dailyscan-${compareScanDate}.json`
      const compareBlob = blobs.blobs.find((blob) => blob.pathname === comparePath)
      if (compareBlob) {
        const token = process.env.BLOB_READ_WRITE_TOKEN
        const compareResponse = await fetch(compareBlob.url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (compareResponse.ok) {
          const comparePayload = await compareResponse.json() as ScanPayload
          const parsedCompare = parseScanPayload(comparePayload, tickers)
          comparison = buildComparison(data, parsedCompare.data, Object.keys(PERIOD_DAYS), 'live', compareScanDate)
        }
      }
    }

    return NextResponse.json({
      tickers: data,
      periods: Object.keys(PERIOD_DAYS),
      asOf: formatDate(endDate),
      viewMode,
      normalizationTicker: normalizationTicker || null,
      errors: failures,
      source: 'live',
      scanDate: 'live',
      compareScanDate: compareScanDate || null,
      comparison,
      availableScanDates,
    })
  } catch (error) {
    console.error('Performance summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
