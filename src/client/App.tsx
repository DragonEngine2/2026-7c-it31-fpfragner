import { useEffect, useState, useRef, type FormEvent } from 'react'
import type { Item } from '../shared/schemas'
import { api } from './api'

// Standard-Videomaterial für Blender, Stop-Motion und Live-Action als Fallbacks
const DEFAULT_VIDEOS: Record<string, { videoUrl: string; thumbnail: string; duration: string }> = {
  'Big Buck Bunny': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    duration: '9:56 Min.',
  },
  'Tears of Steel': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    duration: '12:14 Min.',
  },
  'Sintel – The Dragon\'s Heart': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    duration: '14:48 Min.',
  },
  'Clay Quest: The Lost Clayman': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    duration: '3:20 Min.',
  },
  'Elephants Dream': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    duration: '10:53 Min.',
  },
  'The Mechanical Clockwork': {
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    duration: '4:15 Min.',
  },
}

// Extrahiert URL und Beschreibung aus dem Notizfeld
function parseNote(rawNote: string, title: string) {
  let videoUrl = ''
  let description = rawNote

  if (rawNote.includes('http://') || rawNote.includes('https://')) {
    const match = rawNote.match(/(https?:\/\/[^\s|]+)/)
    if (match) {
      videoUrl = match[1]
      description = rawNote.replace(match[1], '').replace(/^[\s|]+|[\s|]+$/g, '').trim()
    }
  }

  // Fallback auf voreingestellte Videos
  if (!videoUrl) {
    if (DEFAULT_VIDEOS[title]) {
      videoUrl = DEFAULT_VIDEOS[title].videoUrl
    } else {
      videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    }
  }

  return { videoUrl, description: description || 'Keine Beschreibung hinterlegt.' }
}

// Bestimmt die Kategorie-Farben
function getCategoryBadge(category: string) {
  const norm = category.toLowerCase()
  if (norm.includes('blender') || norm.includes('3d') || norm.includes('cgi')) {
    return {
      bg: 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300',
      tag: 'Blender 3D',
      icon: '📐',
    }
  }
  if (norm.includes('stop') || norm.includes('clay') || norm.includes('knete')) {
    return {
      bg: 'bg-amber-950/80 border-amber-700/60 text-amber-300',
      tag: 'Stop-Motion',
      icon: '🎞️',
    }
  }
  return {
    bg: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300',
    tag: 'Live-Action',
    icon: '🎬',
  }
}

export function App() {
  const [items, setItems] = useState<Item[]>([])
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Blender Animation')
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle')
  const [filterStatus, setFilterStatus] = useState<'all' | 'watchlist' | 'watched'>('all')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState('')
  const [isTheaterOpen, setIsTheaterOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const reload = async () => {
    try {
      const data = await api.list()
      setItems(data)
      if (data.length > 0 && !activeItem) {
        setActiveItem(data[0])
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  // Startet Film im Kinoplayer
  function playVideo(item: Item) {
    setActiveItem(item)
    setIsTheaterOpen(true)
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        videoRef.current.play().catch(() => {
          // Autoplay Richtlinie im Browser
        })
      }
    }, 100)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    const combinedNote = videoUrlInput.trim()
      ? `${videoUrlInput.trim()} | ${descriptionInput.trim() || 'Community-Upload'}`
      : descriptionInput.trim() || 'Animation / Live-Action Film'

    try {
      const created = await api.create({
        title: title.trim(),
        category: category.trim() || 'Blender Animation',
        note: combinedNote,
      })
      setTitle('')
      setVideoUrlInput('')
      setDescriptionInput('')
      setIsAdding(false)
      setError('')
      await reload()
      setActiveItem(created)
      setIsTheaterOpen(true)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function toggleWatchlist(item: Item) {
    try {
      await api.update(item.id, { done: !item.done })
      await reload()
      if (activeItem?.id === item.id) {
        setActiveItem({ ...activeItem, done: !item.done })
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function removeItem(item: Item) {
    try {
      await api.remove(item.id)
      if (activeItem?.id === item.id) {
        setActiveItem(null)
        setIsTheaterOpen(false)
      }
      await reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Filterung der Filme
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.note.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory =
      selectedCategory === 'Alle' ||
      item.category.toLowerCase().includes(selectedCategory.toLowerCase())

    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'watchlist' && !item.done) ||
      (filterStatus === 'watched' && item.done)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const currentVideoData = activeItem
    ? parseNote(activeItem.note, activeItem.title)
    : null

  const isYouTube = (url: string) =>
    url.includes('youtube.com') || url.includes('youtu.be')

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1].split('?')[0]
        return `https://www.youtube.com/embed/${id}?autoplay=1`
      }
      const match = url.match(/[?&]v=([^&]+)/)
      return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url
    } catch {
      return url
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header & Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-rose-600 flex items-center justify-center shadow-lg shadow-brand/30">
              <span className="text-xl">📽️</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
                  Frame<span className="text-brand">Stream</span>
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                  KINO & ANIMATION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Stop-Motion · Blender 3D · Live-Action Cinema
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-brand hover:bg-brand-dark text-white transition-all shadow-md shadow-brand/25 active:scale-95 cursor-pointer"
            >
              <span>{isAdding ? '✕ Schließen' : '+ Video hinzufügen'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Fehlermeldung */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full pt-4">
          <div className="flex items-center justify-between rounded-lg bg-red-950/90 border border-red-700/60 p-3.5 text-red-200 text-sm">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError('')}
              className="font-bold uppercase text-xs hover:underline text-red-300 ml-4 cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

      {/* Video Hinzufügen Formular */}
      {isAdding && (
        <section className="bg-slate-900 border-b border-slate-800 p-6 shadow-2xl transition-all">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🎬</span> Neues Video in den Katalog aufnehmen
              </h2>
              <span className="text-xs text-slate-400">
                Unterstützt MP4, WebM und YouTube
              </span>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Filmtitel *
                  </label>
                  <input
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
                    placeholder="z. B. Der Knetkrieger (Stop-Motion)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Spezialisierung / Kategorie
                  </label>
                  <select
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-brand"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Blender Animation">Blender 3D Animation</option>
                    <option value="Stop-Motion">Stop-Motion (Knete/Puppen)</option>
                    <option value="Live-Action">Live-Action (Realfilm/VFX)</option>
                    <option value="Making-of & Tutorial">Making-of / Tutorial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Video-URL (MP4 Direktlink oder YouTube)
                </label>
                <input
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
                  placeholder="https://.../mein-video.mp4 oder https://youtu.be/..."
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Beschreibung / Regie & Technik
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
                  placeholder="Handlung, verwendete Blender-Tools oder Stop-Motion Frame-Rate..."
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex gap-2">
                  <span className="text-xs text-slate-400 self-center">Schnell-Vorlagen:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Cosmos Laundromat')
                      setCategory('Blender Animation')
                      setVideoUrlInput('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4')
                      setDescriptionInput('Blender Open Movie Projekt Gooseberry: Surreale 3D-Welt auf einer einsamen Insel.')
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-cyan-300 border border-cyan-800/40 cursor-pointer"
                  >
                    + Blender Sci-Fi
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle('Clay Wars: Die Schlacht am Küchentisch')
                      setCategory('Stop-Motion')
                      setVideoUrlInput('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4')
                      setDescriptionInput('Aufwendige Knetanimation mit über 1.200 handfotografierten Einzelbildern.')
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded text-amber-300 border border-amber-800/40 cursor-pointer"
                  >
                    + Stop-Motion Action
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold rounded-lg bg-brand hover:bg-brand-dark text-white cursor-pointer"
                  >
                    Video speichern
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      )}

      {/* Kinosaal / Haupt-Videoplayer (Theater Mode) */}
      {activeItem && currentVideoData && (
        <section className={`bg-black border-b border-slate-800 transition-all ${isTheaterOpen ? 'py-6' : 'py-3'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
                  {isTheaterOpen ? 'Kinosaal aktiv' : 'Ausgewähltes Video'}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded border ${getCategoryBadge(activeItem.category).bg}`}>
                  {getCategoryBadge(activeItem.category).icon} {activeItem.category}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsTheaterOpen(!isTheaterOpen)}
                  className="text-xs text-slate-300 hover:text-white px-2.5 py-1 bg-slate-800 rounded border border-slate-700 cursor-pointer"
                >
                  {isTheaterOpen ? 'Player minimieren' : 'Großer Player'}
                </button>
                <button
                  onClick={() => toggleWatchlist(activeItem)}
                  className={`text-xs px-3 py-1 rounded font-semibold transition-all cursor-pointer ${
                    activeItem.done
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {activeItem.done ? '✓ Bereits gesehen' : '+ Auf Watchlist'}
                </button>
              </div>
            </div>

            {/* Video-Screen */}
            <div className={`relative bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 ${isTheaterOpen ? 'aspect-video w-full' : 'aspect-[21/9] w-full max-h-[380px]'}`}>
              {isYouTube(currentVideoData.videoUrl) ? (
                <iframe
                  src={getYouTubeEmbedUrl(currentVideoData.videoUrl)}
                  title={activeItem.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  ref={videoRef}
                  key={currentVideoData.videoUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  preload="metadata"
                >
                  <source src={currentVideoData.videoUrl} type="video/mp4" />
                  Dein Browser unterstützt das Video-Tag leider nicht.
                </video>
              )}
            </div>

            {/* Video Details unter dem Player */}
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1 min-w-[280px]">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {activeItem.title}
                </h2>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">
                  {currentVideoData.description}
                </p>
                <div className="mt-2 text-xs text-slate-500">
                  Hinzugefügt am: {new Date(activeItem.createdAt).toLocaleDateString('de-DE')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleWatchlist(activeItem)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                >
                  {activeItem.done ? 'Status: Gesehen (Umschalten)' : 'Als gesehen markieren'}
                </button>
                <button
                  onClick={() => removeItem(activeItem)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800/60 cursor-pointer"
                  title="Film aus Bibliothek entfernen"
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hauptbereich: Suche, Kategorien & Filmkatalog */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Filter-Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          {/* Kategorie-Pills */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {[
              { id: 'Alle', label: 'Alle Filme', icon: '🍿' },
              { id: 'Blender Animation', label: 'Blender 3D', icon: '📐' },
              { id: 'Stop-Motion', label: 'Stop-Motion', icon: '🎞️' },
              { id: 'Live-Action', label: 'Live-Action', icon: '🎬' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-brand text-white shadow-lg shadow-brand/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Status & Suche */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Watchlist Filter */}
            <div className="inline-flex rounded-lg bg-slate-800/90 p-1 border border-slate-700 text-xs font-medium">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  filterStatus === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Alle ({items.length})
              </button>
              <button
                onClick={() => setFilterStatus('watchlist')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  filterStatus === 'watchlist' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Watchlist ({items.filter((i) => !i.done).length})
              </button>
              <button
                onClick={() => setFilterStatus('watched')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  filterStatus === 'watched' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Gesehen ({items.filter((i) => i.done).length})
              </button>
            </div>

            {/* Suchfeld */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <input
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand"
                placeholder="Film oder Technik suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-2.5 top-2 text-slate-500 text-xs">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1.5 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filme-Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const { description } = parseNote(item.note, item.title)
            const badge = getCategoryBadge(item.category)
            const defaultMeta = DEFAULT_VIDEOS[item.title]
            const thumbUrl =
              defaultMeta?.thumbnail ||
              (item.category.toLowerCase().includes('blender')
                ? 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'
                : item.category.toLowerCase().includes('stop')
                  ? 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80'
                  : 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80')

            const isPlaying = activeItem?.id === item.id

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col bg-slate-900/90 rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/10 ${
                  isPlaying
                    ? 'border-brand ring-2 ring-brand/40 shadow-xl'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Poster / Thumbnail */}
                <div
                  className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer"
                  onClick={() => playVideo(item)}
                >
                  <img
                    src={thumbUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                    loading="lazy"
                  />

                  {/* Play-Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-brand/90 text-white flex items-center justify-center text-xl shadow-lg transition-transform group-hover:scale-110">
                      ▶
                    </div>
                  </div>

                  {/* Kategorie Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md border shadow-md ${badge.bg}`}>
                      {badge.icon} {badge.tag}
                    </span>
                  </div>

                  {/* Status / Dauer Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {item.done ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/90 text-white rounded shadow">
                        ✓ Gesehen
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-900/90 text-slate-300 rounded border border-slate-700 shadow">
                        Watchlist
                      </span>
                    )}
                    {defaultMeta?.duration && (
                      <span className="px-2 py-0.5 text-[10px] font-mono bg-black/80 text-slate-300 rounded">
                        {defaultMeta.duration}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info & Aktionen */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3
                      onClick={() => playVideo(item)}
                      className="text-base font-bold text-white hover:text-rose-400 transition-colors line-clamp-1 cursor-pointer"
                    >
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => playVideo(item)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>▶</span>
                      <span>{isPlaying ? 'Wird abgespielt' : 'Jetzt ansehen'}</span>
                    </button>

                    <button
                      onClick={() => toggleWatchlist(item)}
                      className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                        item.done
                          ? 'bg-emerald-950/80 border-emerald-700 text-emerald-400 hover:bg-emerald-900'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                      title={item.done ? 'Als ungesehen markieren' : 'Als gesehen markieren'}
                    >
                      {item.done ? '✓' : '+'}
                    </button>

                    <button
                      onClick={() => removeItem(item)}
                      className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-red-950 border border-slate-700/60 hover:border-red-700 text-slate-400 hover:text-red-400 text-xs transition-colors cursor-pointer"
                      title="Löschen"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Leerer Zustand */}
        {filteredItems.length === 0 && (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            <span className="text-4xl">🎬</span>
            <h3 className="mt-3 text-lg font-bold text-white">Keine Videos gefunden</h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              Für die gewählten Filter oder den Suchbegriff „{searchQuery}“ gibt es noch keine passenden Einträge.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => {
                  setSelectedCategory('Alle')
                  setFilterStatus('all')
                  setSearchQuery('')
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Filter zurücksetzen
              </button>
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 text-xs font-semibold bg-brand hover:bg-brand-dark text-white rounded-lg cursor-pointer"
              >
                + Erstes Video hinzufügen
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-900/80 py-6 text-center text-xs text-slate-500">
        <p>
          <strong className="text-slate-400">FrameStream</strong> – Spezialisiert auf Stop-Motion, Blender-3D & Live-Action Kurzfilme.
        </p>
        <p className="mt-1">
          Schul-Fullstack-App (BRG Kepler Graz, 7. Klasse) · Hono API · SQLite / In-Memory Store · Vite & React
        </p>
      </footer>
    </div>
  )
}
