import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.TOOLS_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const xcel360Url = process.env.XCEL360_URL
  const toolsSecret = process.env.TOOLS_SECRET

  if (!xcel360Url) return NextResponse.json({ error: 'XCEL360_URL not set', url: null }, { status: 500 })
  if (!toolsSecret) return NextResponse.json({ error: 'TOOLS_SECRET not set' }, { status: 500 })

  const target = `${xcel360Url}/api/tools/ping`
  try {
    const res = await fetch(target, {
      headers: { Authorization: `Bearer ${toolsSecret}` },
    })
    const data = await res.json()
    return NextResponse.json({ url: target, status: res.status, response: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ url: target, error: msg }, { status: 502 })
  }
}
