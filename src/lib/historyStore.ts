import type { ClipboardEntry } from '../types'

const DB_NAME = 'airtext'
const STORE_NAME = 'history'
const MAX_ENTRIES = 100
const FALLBACK_KEY = 'airtext-history'

function normalize(entries: ClipboardEntry[]): ClipboardEntry[] {
  const seen = new Set<string>()
  return entries
    .filter((entry) => (entry.kind === 'image' ? Boolean(entry.image) : entry.text.trim().length > 0))
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((entry) => {
      const key = entry.kind === 'image' ? `img:${entry.image}` : `txt:${entry.text}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, MAX_ENTRIES)
}

// Only entries belonging to the active room are visible; leftovers from older
// sessions stay hidden until the next write prunes them from storage.
export function visibleEntries(entries: ClipboardEntry[], roomId: string): ClipboardEntry[] {
  return normalize(entries.filter((entry) => entry.roomId === roomId))
}

function fallbackRead(): ClipboardEntry[] {
  try {
    const value = localStorage.getItem(FALLBACK_KEY)
    return value ? normalize(JSON.parse(value) as ClipboardEntry[]) : []
  } catch {
    return []
  }
}

function fallbackWrite(entries: ClipboardEntry[]): void {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalize(entries)))
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAll(): Promise<ClipboardEntry[]> {
  if (!('indexedDB' in window)) return fallbackRead()
  try {
    const db = await openDatabase()
    const { promise, resolve, reject } = Promise.withResolvers<ClipboardEntry[]>()
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as ClipboardEntry[])
    request.onerror = () => reject(request.error)
    return await promise
  } catch {
    return fallbackRead()
  }
}

export async function loadHistory(roomId: string): Promise<ClipboardEntry[]> {
  return visibleEntries(await readAll(), roomId)
}

export async function saveEntry(entry: ClipboardEntry, roomId: string): Promise<ClipboardEntry[]> {
  // Stamp the room and keep only this room's entries: a new session must not
  // inherit items from an older one.
  const stamped: ClipboardEntry = { ...entry, roomId }
  const entries = visibleEntries(await readAll(), roomId)
  const merged = normalize([stamped, ...entries])
  if (!('indexedDB' in window)) {
    fallbackWrite(merged)
    return merged
  }
  try {
    const db = await openDatabase()
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    store.clear()
    merged.forEach((item) => store.put(item))
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    await promise
  } catch {
    fallbackWrite(merged)
  }
  return merged
}

export async function clearHistory(): Promise<ClipboardEntry[]> {
  if (!('indexedDB' in window)) {
    localStorage.removeItem(FALLBACK_KEY)
    return []
  }
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch {
    localStorage.removeItem(FALLBACK_KEY)
  }
  return []
}

export function createEntry(text: string, source: ClipboardEntry['source'], image?: string): ClipboardEntry {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    source,
    kind: image ? 'image' : 'text',
    image,
  }
}

export const historyLimit = MAX_ENTRIES
export { normalize as normalizeHistory }
