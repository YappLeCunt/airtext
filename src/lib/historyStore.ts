import type { ClipboardEntry } from '../types'

const DB_NAME = 'airtext'
const STORE_NAME = 'history'
const MAX_ENTRIES = 100
const FALLBACK_KEY = 'airtext-history'

function normalize(entries: ClipboardEntry[]): ClipboardEntry[] {
  const seen = new Set<string>()
  return entries
    .filter((entry) => entry.text.trim().length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)
    .filter((entry) => {
      if (seen.has(entry.text)) return false
      seen.add(entry.text)
      return true
    })
    .slice(0, MAX_ENTRIES)
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

export async function loadHistory(): Promise<ClipboardEntry[]> {
  if (!('indexedDB' in window)) return fallbackRead()
  try {
    const db = await openDatabase()
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve(normalize(request.result as ClipboardEntry[]))
      request.onerror = () => reject(request.error)
    })
  } catch {
    return fallbackRead()
  }
}

export async function saveEntry(entry: ClipboardEntry): Promise<ClipboardEntry[]> {
  const entries = normalize([entry, ...(await loadHistory())])
  if (!('indexedDB' in window)) {
    fallbackWrite(entries)
    return entries
  }
  try {
    const db = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      store.clear()
      entries.forEach((item) => store.put(item))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch {
    fallbackWrite(entries)
  }
  return entries
}

export function createEntry(text: string, source: ClipboardEntry['source']): ClipboardEntry {
  return {
    id: crypto.randomUUID(),
    text,
    createdAt: Date.now(),
    source,
  }
}

export const historyLimit = MAX_ENTRIES
export { normalize as normalizeHistory }
