import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const apiKey = process.env.POLLINATIONS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing POLLINATIONS_API_KEY' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const sectorPeriod = String(body?.sectorPeriod || '1D')
    const sectorSnapshot = String(body?.sectorSnapshot || '')

    const prompt =
      `Summarize today’s market action and any sector rotation in plain English. ` +
      `Use this sector return snapshot for context (period: ${sectorPeriod}): ${sectorSnapshot} ` +
      `Use 4-6 bullets.`

    const textUrl = `https://text.pollinations.ai/prompt/${encodeURIComponent(prompt)}`
    const textResponse = await fetch(textUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    const textBody = await textResponse.text()
    const textBodyClean = textBody?.trim()

    if (
      textResponse.ok &&
      textBodyClean &&
      !textBodyClean.includes('[object Object]')
    ) {
      return NextResponse.json({ summary: textBody })
    }

    const response = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          {
            role: 'system',
            content: 'You are a concise market analyst. Summarize today’s market and note any sector rotation. Use 4-6 bullets.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    const rawText = await response.text()
    let data: any = null
    try {
      data = rawText ? JSON.parse(rawText) : null
    } catch {
      data = null
    }
    const normalizeError = (value: unknown): string => {
      if (typeof value === 'string') {
        return value
      }
      if (value instanceof Error) {
        return value.message
      }
      try {
        return JSON.stringify(value)
      } catch {
        return String(value)
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: normalizeError(data?.error || rawText || textBody || 'Failed to fetch summary') },
        { status: 500 }
      )
    }

    const rawSummary =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.text ??
      data?.summary ??
      rawText ??
      textBody
    const summary = typeof rawSummary === 'string'
      ? rawSummary
      : Array.isArray(rawSummary)
        ? rawSummary.join(' ')
        : rawSummary
          ? JSON.stringify(rawSummary)
          : ''
    if (!summary || summary.trim().includes('[object Object]')) {
      return NextResponse.json({ error: 'No summary returned' }, { status: 500 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Market summary error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
