'use client'

import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import {
  Lock, Sparkles, X, Send, RotateCcw,
  ImageIcon, FileText, CheckCircle2, Loader2, ExternalLink,
  GraduationCap, Briefcase, Building2, Wifi,
} from 'lucide-react'

type PostType = 'SCHOLARSHIP' | 'JOB' | 'INTERNSHIP'

interface Extracted {
  postType: PostType
  title: string; hostOrg: string; country: string
  fundingType: string; field: string; programLevel: string[]
  deadline: string | null; eligibility: string; description: string
  applicationLink: string; requiredDocs: string[]; fieldTags: string[]
  // job / internship extras
  company: string; jobType: string; salary: string
  remote: boolean; experienceLevel: string; skills: string[]
}

const POST_TYPES: { type: PostType; label: string; sub: string; icon: React.ReactNode; color: string }[] = [
  {
    type: 'SCHOLARSHIP',
    label: 'Scholarship',
    sub: 'Funding, grants, fellowships & academic awards',
    icon: <GraduationCap size={28} />,
    color: 'from-violet-600 to-blue-600',
  },
  {
    type: 'JOB',
    label: 'Job',
    sub: 'Full-time, part-time & contract positions',
    icon: <Briefcase size={28} />,
    color: 'from-emerald-600 to-teal-600',
  },
  {
    type: 'INTERNSHIP',
    label: 'Internship',
    sub: 'Paid & unpaid internship programmes',
    icon: <Building2 size={28} />,
    color: 'from-orange-500 to-amber-500',
  },
]

const FUNDING_TYPES = ['Fully funded', 'Partial', 'Tuition only', 'Stipend only', 'Other']
const FIELDS = ['STEM', 'Non-STEM', 'Arts', 'Business', 'Law', 'Medicine', 'Social Sciences', 'Humanities', 'General']
const LEVELS = ['Undergraduate', 'Masters', 'PhD', 'Postdoctoral', 'Professional', 'Any']
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Volunteer']
const INTERNSHIP_TYPES = ['Full-time', 'Part-time', 'Paid', 'Unpaid', 'Hybrid']
const EXP_LEVELS = ['Entry Level', 'Mid Level', 'Senior Level', 'Executive', 'Internship']

function compressImage(file: File): Promise<{ data: string; mediaType: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl })
    }
    img.onerror = reject
    img.src = url
  })
}

export default function ToolsPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [postType, setPostType] = useState<PostType | null>(null)
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [publishedId, setPublishedId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, authCheck: true }),
    })
    setAuthLoading(false)
    if (res.status === 401) { toast.error('Wrong password'); return }
    setAuthed(true)
    toast.success('Welcome back!')
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Images only'); return }
    try { setImage(await compressImage(file)) }
    catch { toast.error('Could not process image') }
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Images only'); return }
    try { setImage(await compressImage(file)); toast.success('Image pasted!') }
    catch { toast.error('Could not process image') }
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!item) return
      const file = item.getAsFile()
      if (file) handleImageFile(file)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  async function handleExtract() {
    if (!text.trim() && !image) { toast.error('Add text or an image first'); return }
    setExtracting(true); setExtracted(null)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password, postType,
          text: text || undefined,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Extraction failed', { duration: 8000 }); return }
      setExtracted(data)
      toast.success('Extracted! Review and publish.')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Network error', { duration: 8000 }) }
    finally { setExtracting(false) }
  }

  async function handlePublish() {
    if (!extracted) return
    setPublishing(true)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, ...extracted }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? `Publish failed (${res.status})`, { duration: 10000 }); return }
      if (!data.id || !data.title) {
        toast.error(`Unexpected response: ${JSON.stringify(data)}`, { duration: 15000 })
        return
      }
      setPublishedId(data.id)
      setPublished(true)
      toast.success(`Published: "${data.title}"`, { duration: 6000 })
    } catch { toast.error('Publish failed') }
    finally { setPublishing(false) }
  }

  function reset() {
    setText(''); setImage(null); setExtracted(null); setPublished(false); setPublishedId(null); setPostType(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function setField<K extends keyof Extracted>(key: K, val: Extracted[K]) {
    setExtracted((p) => p ? { ...p, [key]: val } : p)
  }

  function toggleChip(key: 'programLevel' | 'skills', val: string) {
    setExtracted((p) => {
      if (!p) return p
      const arr = p[key] as string[]
      return { ...p, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] }
    })
  }

  const typeConfig = POST_TYPES.find((t) => t.type === postType)

  /* ── Lock screen ── */
  if (!authed) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Xcel360 Tools</h1>
          <p className="text-gray-400 text-sm mt-1">Internal admin portal</p>
        </div>
        <form onSubmit={handleAuth} className="space-y-3">
          <input
            type="password" required placeholder="Enter password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 placeholder-gray-500"
          />
          <button type="submit" disabled={authLoading}
            className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {authLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Unlock
          </button>
        </form>
      </div>
    </div>
  )

  async function testConnection() {
    const tid = toast.loading('Testing connection to Xcel360…')
    try {
      const res = await fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      toast.dismiss(tid)
      if (data.response?.ok) {
        toast.success(`Connected! → ${data.url}`, { duration: 8000 })
      } else {
        toast.error(`Failed → ${data.url}\n${data.status ? `HTTP ${data.status}` : data.error}`, { duration: 12000 })
      }
    } catch {
      toast.dismiss(tid)
      toast.error('Connection test failed')
    }
  }

  /* ── Type selection screen ── */
  if (!postType) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={20} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">What are you posting?</h1>
          <p className="text-gray-400 text-sm mt-2">Choose a type — Claude will extract the right fields automatically.</p>
        </div>
        <div className="space-y-3">
          {POST_TYPES.map(({ type, label, sub, icon, color }) => (
            <button key={type} onClick={() => setPostType(type)}
              className="w-full flex items-center gap-5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-600 rounded-2xl px-6 py-5 text-left transition-all group">
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform`}>
                {icon}
              </div>
              <div>
                <p className="text-white font-semibold text-base">{label}</p>
                <p className="text-gray-400 text-sm mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>
        <button onClick={testConnection}
          className="mt-6 w-full flex items-center justify-center gap-2 text-xs text-gray-600 hover:text-gray-400 transition-colors py-2">
          <Wifi size={12} /> Test connection to Xcel360
        </button>
      </div>
    </div>
  )

  /* ── Success screen ── */
  if (published) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={40} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Published!</h2>
        <p className="text-gray-400 mb-1 text-sm font-medium">{extracted?.title}</p>
        <p className="text-gray-600 text-xs mb-8">Now live on Xcel360</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset}
            className="flex items-center gap-2 bg-gray-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors">
            <RotateCcw size={14} /> Post Another
          </button>
          <a
            href={publishedId ? `https://thexcel360.com/opportunities/${publishedId}` : 'https://thexcel360.com/opportunities'}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-violet-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-violet-500 transition-colors">
            <ExternalLink size={14} /> View Live
          </a>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-gray-950 z-10">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeConfig?.color ?? 'from-violet-600 to-blue-600'} flex items-center justify-center`}>
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Xcel360 Tools</p>
            <p className="text-xs text-gray-500">{typeConfig?.label} Poster</p>
          </div>
        </div>
        <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
          <RotateCcw size={12} /> Start Over
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!extracted ? (
          /* ── Input stage ── */
          <div>
            <h2 className="text-xl font-bold mb-1">AI {typeConfig?.label} Extractor</h2>
            <p className="text-gray-400 text-sm mb-6">Upload a flyer, paste text, or both — Claude fills the form automatically.</p>

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upload Image</p>
                {image ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.preview} alt="Flyer" className="w-full h-48 object-contain bg-gray-900" />
                    <button onClick={() => setImage(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-700 hover:border-violet-500 hover:bg-violet-500/5 transition-all flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-violet-400">
                    <ImageIcon size={28} />
                    <span className="text-sm font-medium">Click to upload or Ctrl+V to paste</span>
                    <span className="text-xs">JPG, PNG, WebP</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paste Text</p>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
                  placeholder={`Paste ${typeConfig?.label.toLowerCase()} announcement, email, or webpage text…`}
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500 h-48" />
              </div>
            </div>

            <button onClick={handleExtract} disabled={extracting || (!text.trim() && !image)}
              className={`w-full bg-gradient-to-r ${typeConfig?.color ?? 'from-violet-600 to-blue-600'} text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2`}>
              {extracting
                ? <><Loader2 size={16} className="animate-spin" /> Extracting…</>
                : <><Sparkles size={16} /> Extract & Fill Form</>}
            </button>
          </div>
        ) : (
          /* ── Review stage ── */
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Review & Publish</h2>
                <p className="text-gray-400 text-sm">Edit any field before going live.</p>
              </div>
              <button onClick={() => setExtracted(null)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
                <FileText size={12} /> Back to input
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Common fields */}
              {[
                { label: 'Title *', key: 'title' as const },
                postType === 'SCHOLARSHIP'
                  ? { label: 'Host Organisation *', key: 'hostOrg' as const }
                  : { label: 'Company / Organisation *', key: 'company' as const },
                { label: 'Country', key: 'country' as const },
                { label: 'Application Link', key: 'applicationLink' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</label>
                  <input value={(extracted[key] as string) ?? ''}
                    onChange={(e) => setField(key, e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Deadline</label>
                <input type="date" value={extracted.deadline ?? ''}
                  onChange={(e) => setField('deadline', e.target.value || null)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Field</label>
                <select value={extracted.field} onChange={(e) => setField('field', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                  {FIELDS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>

              {postType === 'SCHOLARSHIP' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Funding Type</label>
                  <select value={extracted.fundingType} onChange={(e) => setField('fundingType', e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                    {FUNDING_TYPES.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              )}

              {postType !== 'SCHOLARSHIP' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      {postType === 'JOB' ? 'Job Type' : 'Internship Type'}
                    </label>
                    <select value={extracted.jobType ?? ''} onChange={(e) => setField('jobType', e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                      {(postType === 'JOB' ? JOB_TYPES : INTERNSHIP_TYPES).map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  {postType === 'JOB' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Experience Level</label>
                      <select value={extracted.experienceLevel ?? ''} onChange={(e) => setField('experienceLevel', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                        {EXP_LEVELS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Salary / Stipend</label>
                    <input value={extracted.salary ?? ''} onChange={(e) => setField('salary', e.target.value)}
                      placeholder="e.g. $50,000–$70,000 / Unpaid"
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-gray-600" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="remote" checked={extracted.remote ?? false}
                      onChange={(e) => setField('remote', e.target.checked)}
                      className="w-4 h-4 rounded accent-violet-600" />
                    <label htmlFor="remote" className="text-sm text-gray-300">Remote / Hybrid</label>
                  </div>
                </>
              )}
            </div>

            {/* Program level (scholarship + internship) */}
            {postType !== 'JOB' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Program Level</label>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((l) => (
                    <button key={l} onClick={() => toggleChip('programLevel', l)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        extracted.programLevel?.includes(l)
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Skills (job + internship) */}
            {postType !== 'SCHOLARSHIP' && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Skills</label>
                <input value={(extracted.skills ?? []).join(', ')}
                  onChange={(e) => setField('skills', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. Python, Project Management, Figma"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 placeholder-gray-600" />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Eligibility</label>
              <textarea value={extracted.eligibility} onChange={(e) => setField('eligibility', e.target.value)} rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={extracted.description} onChange={(e) => setField('description', e.target.value)} rows={4}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
            </div>

            <button onClick={handlePublish} disabled={publishing || !extracted.title || (!extracted.hostOrg && !extracted.company)}
              className={`w-full bg-gradient-to-r ${typeConfig?.color ?? 'from-green-600 to-emerald-600'} text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2`}>
              {publishing
                ? <><Loader2 size={16} className="animate-spin" /> Publishing to Xcel360…</>
                : <><Send size={16} /> Publish {typeConfig?.label} to Xcel360</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
