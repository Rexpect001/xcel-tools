'use client'

import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Lock, Sparkles, X, Send, RotateCcw,
  ImageIcon, FileText, CheckCircle2, Loader2, ExternalLink,
} from 'lucide-react'

interface Extracted {
  title: string; hostOrg: string; country: string; fundingType: string
  field: string; programLevel: string[]; deadline: string | null
  eligibility: string; description: string; applicationLink: string
  requiredDocs: string[]; fieldTags: string[]
}

const FUNDING_TYPES = ['Fully funded', 'Partial', 'Tuition only', 'Stipend only', 'Other']
const FIELDS = ['STEM', 'Non-STEM', 'Arts', 'Business', 'Law', 'Medicine', 'Social Sciences', 'Humanities', 'General']
const LEVELS = ['Undergraduate', 'Masters', 'PhD', 'Postdoctoral', 'Professional', 'Any']

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
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
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

  async function handleExtract() {
    if (!text.trim() && !image) { toast.error('Add text or an image first'); return }
    setExtracting(true); setExtracted(null)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password, text: text || undefined,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Extraction failed', { duration: 8000 }); return }
      setExtracted(data)
      toast.success('Extracted! Review and publish.')
    } catch (e: any) { toast.error(e?.message ?? 'Network error', { duration: 8000 }) }
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
      if (!res.ok) { toast.error(data.error ?? 'Publish failed'); return }
      setPublished(true)
      toast.success(`Published: "${data.title}"`)
    } catch { toast.error('Publish failed') }
    finally { setPublishing(false) }
  }

  function reset() {
    setText(''); setImage(null); setExtracted(null); setPublished(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function setField<K extends keyof Extracted>(key: K, val: Extracted[K]) {
    setExtracted((p) => p ? { ...p, [key]: val } : p)
  }

  function toggleLevel(l: string) {
    setExtracted((p) => p ? {
      ...p,
      programLevel: p.programLevel.includes(l)
        ? p.programLevel.filter((x) => x !== l)
        : [...p.programLevel, l]
    } : p)
  }

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
          <a href="https://xcel360.com/opportunities" target="_blank" rel="noopener noreferrer"
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
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Xcel360 Tools</p>
            <p className="text-xs text-gray-500">AI Scholarship Poster</p>
          </div>
        </div>
        <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors">
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!extracted ? (
          /* ── Input stage ── */
          <div>
            <h2 className="text-xl font-bold mb-1">AI Scholarship Extractor</h2>
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
                    <span className="text-sm font-medium">Click to upload flyer</span>
                    <span className="text-xs">JPG, PNG, WebP</span>
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Paste Text</p>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9}
                  placeholder="Paste scholarship announcement, email, or webpage text…"
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500 h-48" />
              </div>
            </div>

            <button onClick={handleExtract} disabled={extracting || (!text.trim() && !image)}
              className="w-full bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
              {extracting
                ? <><Loader2 size={16} className="animate-spin" /> Extracting with Claude…</>
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
              {[
                { label: 'Title *', key: 'title' as const },
                { label: 'Host Organisation *', key: 'hostOrg' as const },
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
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Funding Type</label>
                <select value={extracted.fundingType} onChange={(e) => setField('fundingType', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                  {FUNDING_TYPES.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Field</label>
                <select value={extracted.field} onChange={(e) => setField('field', e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500">
                  {FIELDS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Program Level</label>
              <div className="flex flex-wrap gap-2">
                {LEVELS.map((l) => (
                  <button key={l} onClick={() => toggleLevel(l)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      extracted.programLevel.includes(l)
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Eligibility</label>
              <textarea value={extracted.eligibility} onChange={(e) => setField('eligibility', e.target.value)} rows={2}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Description</label>
              <textarea value={extracted.description} onChange={(e) => setField('description', e.target.value)} rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500" />
            </div>

            <button onClick={handlePublish} disabled={publishing || !extracted.title || !extracted.hostOrg}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
              {publishing
                ? <><Loader2 size={16} className="animate-spin" /> Publishing to Xcel360…</>
                : <><Send size={16} /> Publish to Xcel360</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
