import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { isValidPassword } from '@/app/lib/auth'

export const dynamic = 'force-dynamic'

const SCHOLARSHIP_PROMPT = `You are an assistant that extracts scholarship information from text or images (e.g. flyers, screenshots, social media posts).
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
  "description": "detailed 3-5 sentence overview: what the scholarship covers, its purpose, what makes it valuable, and any notable benefits or unique aspects",
  "applicationLink": "direct application URL if found, else empty string",
  "requiredDocs": ["array of required document names, e.g. CV, SOP, Transcripts, References, Research Proposal"],
  "fieldTags": ["array of relevant subject tags, e.g. Engineering, Medicine, Law"]
}
Return ONLY the JSON object with no markdown, no explanation, no code fences.`

const JOB_PROMPT = `You are an assistant that extracts job listing information from text or images (e.g. flyers, screenshots, social media posts).
Extract all relevant details and return ONLY a valid JSON object with exactly these fields:
{
  "title": "job title",
  "company": "company or organisation name",
  "hostOrg": "same as company",
  "country": "country where the job is based (use 'Global' or 'Remote' if fully remote)",
  "remote": true or false,
  "jobType": "one of: Full-time, Part-time, Contract, Freelance, Volunteer",
  "experienceLevel": "one of: Entry Level, Mid Level, Senior Level, Executive, Internship",
  "salary": "salary range or compensation info, or empty string if not mentioned",
  "field": "one of: STEM, Non-STEM, Arts, Business, Law, Medicine, Social Sciences, Humanities, General",
  "skills": ["array of required skills or technologies, e.g. Python, Project Management, Figma"],
  "deadline": "YYYY-MM-DD format string, or null if not found",
  "eligibility": "requirements — years of experience, qualifications, nationality restrictions, etc.",
  "description": "detailed 3-5 sentence overview: what the role involves, responsibilities, what makes it attractive, and team or company context",
  "applicationLink": "direct application URL if found, else empty string",
  "fieldTags": ["array of relevant tags, e.g. Software, Finance, Marketing"]
}
Return ONLY the JSON object with no markdown, no explanation, no code fences.`

const INTERNSHIP_PROMPT = `You are an assistant that extracts internship listing information from text or images (e.g. flyers, screenshots, social media posts).
Extract all relevant details and return ONLY a valid JSON object with exactly these fields:
{
  "title": "internship title or programme name",
  "company": "company or organisation offering the internship",
  "hostOrg": "same as company",
  "country": "country where the internship is based (use 'Global' or 'Remote' if remote)",
  "remote": true or false,
  "jobType": "one of: Full-time, Part-time, Paid, Unpaid, Hybrid",
  "experienceLevel": "Internship",
  "salary": "stipend or pay info, or empty string if unpaid/not mentioned",
  "field": "one of: STEM, Non-STEM, Arts, Business, Law, Medicine, Social Sciences, Humanities, General",
  "programLevel": ["array from: Undergraduate, Masters, PhD, Any — who is eligible"],
  "skills": ["array of desired skills, e.g. Excel, Communication, Research"],
  "deadline": "YYYY-MM-DD format string, or null if not found",
  "eligibility": "requirements — student status, GPA, nationality, year of study, etc.",
  "description": "detailed 3-5 sentence overview: what the intern will do, learning outcomes, duration, and any notable perks or benefits",
  "applicationLink": "direct application URL if found, else empty string",
  "requiredDocs": ["array of required documents, e.g. CV, Cover Letter, Transcripts"],
  "fieldTags": ["array of relevant tags, e.g. Engineering, Marketing, Research"]
}
Return ONLY the JSON object with no markdown, no explanation, no code fences.`

function getPrompt(postType: string) {
  if (postType === 'JOB') return JOB_PROMPT
  if (postType === 'INTERNSHIP') return INTERNSHIP_PROMPT
  return SCHOLARSHIP_PROMPT
}

function parseJSON(raw: string) {
  const clean = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim()
  return JSON.parse(clean)
}

/* ── Provider 1: Claude (Anthropic) ── */
async function tryAnthropic(prompt: string, text?: string, image?: { data: string; mediaType: string }) {
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
  content.push({ type: 'text', text: text?.trim() || 'Extract all details from this image.' })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: prompt,
    messages: [{ role: 'user', content }],
  })

  const raw = message.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.TextBlock).text).join('')
  return { result: parseJSON(raw), provider: 'Claude' }
}

/* ── Provider 2: Gemini 1.5 Flash (Google — free tier) ── */
async function tryGemini(prompt: string, text?: string, image?: { data: string; mediaType: string }) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('No Gemini key')

  const parts: object[] = [{ text: prompt }]
  if (image?.data) {
    parts.push({ inlineData: { mimeType: image.mediaType || 'image/jpeg', data: image.data } })
  }
  parts.push({ text: text?.trim() || 'Extract all details from this image.' })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Empty Gemini response')
  return { result: parseJSON(raw), provider: 'Gemini' }
}

/* ── Provider 3: DeepSeek (text-only) ── */
async function tryDeepSeek(prompt: string, text?: string) {
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
        { role: 'system', content: prompt },
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
  const { text, image, password, authCheck, postType } = await req.json()

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (authCheck) return NextResponse.json({ ok: true })

  if (!text?.trim() && !image?.data) {
    return NextResponse.json({ error: 'Provide text or an image' }, { status: 400 })
  }

  const prompt = getPrompt(postType ?? 'SCHOLARSHIP')
  const errors: string[] = []

  const providers = [
    () => tryAnthropic(prompt, text, image),
    () => tryGemini(prompt, text, image),
    () => tryDeepSeek(prompt, text),
  ]

  for (const provider of providers) {
    try {
      const { result, provider: name } = await provider()
      console.log(`✓ Extracted via ${name}`)
      return NextResponse.json({ ...result, postType: postType ?? 'SCHOLARSHIP' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`Provider failed: ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json(
    { error: `All providers failed. Errors: ${errors.join(' | ')}` },
    { status: 500 }
  )
}
