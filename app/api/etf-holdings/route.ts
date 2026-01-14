import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const ticker = searchParams.get('ticker')

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker is required' }, { status: 400 })
  }

  // Return empty array - frontend uses predefined ETF holdings mapping
  // In the future, this could be enhanced to fetch real-time holdings
  return NextResponse.json({ holdings: [] })
}
