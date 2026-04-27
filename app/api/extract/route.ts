import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT = `You are an assistant that extracts scholarship information from text or images (e.g. flyers, screenshots, social media posts).
Extract all relevant details and return ONLY a valid JSON object with exactly these fields:
{
  "title": "full scholarship/program name",
  "hostOrg": "hosting organization or university name",
  "country": "country name (use 'Global' if international/multiple countries)",
  "fundingType": "one of: Fully funded, Partial, Tuition only, Stipend only, Other",
  "field": "one of: STEM, Non-STEM, Arts, Business, Law, Medicine, Social Sciences, Humanities, General",
  "programLevel": ["array from: Undergraduate, Masters, PhD, Postdoctoral, Professional, Any"],
  "deadline": "YYYY-MM-DD format string, or null if not found",
  "eligibility": "who can apply — nationalities, GPA, degree requirements, etc.",
  "description": "concise overview of what the scholarship covers and its purpose",
  "applicationLink": "direct application URL if found, else empty string",
  "requiredDocs": ["array of required document names, e.g. CV, SOP, Transcripts, References, Research Proposal"],
  "fieldTags": ["array of relevant subject tags, e.g. Engineering, Medicine, Law"]
}
Return ONLY the JSON object with no markdown, no explanation, no code fences.`

export async function POST(req: NextRequest) {
  const { text, image, password, authCheck } = await req.json()

  const storedPassword = process.env.TOOLS_PASSWORD
  if (!storedPassword || password !== storedPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Auth-only ping — just verify password, no extraction needed
  if (authCheck) {
    return NextResponse.json({ ok: true })
  }

  if (!text?.trim() && !image?.data) {
    return NextResponse.json({ error: 'Provide text or an image' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const content: Anthropic.MessageParam['content'] = []

  if (image?.data) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: (image.mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image.data,
      },
    })
  }

  content.push({ type: 'text', text: text?.trim() || 'Extract all scholarship details from this image.' })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const raw = message.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('')
    const clean = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch (err: any) {
    console.error('Extract error:', err)
    return NextResponse.json(
      { error: err?.message ?? err?.error?.message ?? 'Extraction failed — check Vercel logs' },
      { status: 500 }
    )
  }
}
