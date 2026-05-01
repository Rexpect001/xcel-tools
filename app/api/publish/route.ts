import { NextRequest, NextResponse } from 'next/server'
import { isValidPassword } from '@/app/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const { password, ...opportunity } = await req.json()

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const xcel360Url = process.env.XCEL360_URL
  const toolsSecret = process.env.TOOLS_SECRET

  if (!xcel360Url) return NextResponse.json({ error: 'XCEL360_URL env var not set' }, { status: 500 })
  if (!toolsSecret) return NextResponse.json({ error: 'TOOLS_SECRET env var not set' }, { status: 500 })

  const target = `${xcel360Url}/api/tools/post-opportunity`
  console.log(`Publishing to: ${target}`)

  let res: Response
  try {
    res = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${toolsSecret}`,
      },
      body: JSON.stringify(opportunity),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Fetch to Xcel360 failed:', msg)
    return NextResponse.json({ error: `Could not reach Xcel360: ${msg}` }, { status: 502 })
  }

  const text = await res.text()
  console.log(`Xcel360 responded ${res.status}: ${text}`)

  let data: unknown
  try { data = JSON.parse(text) } catch { data = { error: text } }

  if (!res.ok) return NextResponse.json(data, { status: res.status })
  return NextResponse.json(data)
}
