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

function parseJSON(raw: string) {
  const clean = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(clean)
}

/* ── Provider 1: Claude (Anthropic) ── */
async function tryAnthropic(text?: string, image?: { data: string; mediaType: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('No Anthropic key')

  const client = new Anthropic({ apiKey })
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

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
  })

  const raw = message.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('')
  return { result: parseJSON(raw), provider: 'Claude' }
}

/* ── Provider 2: Gemini 1.5 Flash (Google — free tier) ── */
async function tryGemini(text?: string, image?: { data: string; mediaType: string }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No Gemini key')

  const parts: object[] = []
  if (image?.data) {
    parts.push({ inlineData: { mimeType: image.mediaType || 'image/jpeg', data: image.data } })
  }
  parts.push({ text: text?.trim() || 'Extract all scholarship details from this image.' })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.1, responseMimeType: 'application/json' },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Empty Gemini response')
  return { result: parseJSON(raw), provider: 'Gemini' }
}

/* ── Provider 3: DeepSeek (free tier) ── */
async function tryDeepSeek(text?: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('No DeepSeek key')

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      max_tokens: 1024,
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text?.trim() || 'No text provided.' },
      ],
    }),
  })
  if (!res.ok) throw new Error(`DeepSeek error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('Empty DeepSeek response')
  return { result: parseJSON(raw), provider: 'DeepSeek' }
}

/* ── Main handler ── */
export async function POST(req: NextRequest) {
  const { text, image, password, authCheck } = await req.json()

  const storedPassword = process.env.TOOLS_PASSWORD
  if (!storedPassword || password !== storedPassword) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (authCheck) return NextResponse.json({ ok: true })

  if (!text?.trim() && !image?.data) {
    return NextResponse.json({ error: 'Provide text or an image' }, { status: 400 })
  }

  const errors: string[] = []

  // Try each provider in order — stop at first success
  const providers = [
    () => tryAnthropic(text, image),
    () => tryGemini(text, image),
    () => tryDeepSeek(text), // DeepSeek is text-only
  ]

  for (const provider of providers) {
    try {
      const { result, provider: name } = await provider()
      console.log(`✓ Extracted via ${name}`)
      return NextResponse.json(result)
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      console.warn(`Provider failed: ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json(
    { error: `All providers failed. Errors: ${errors.join(' | ')}` },
    { status: 500 }
  )
}
