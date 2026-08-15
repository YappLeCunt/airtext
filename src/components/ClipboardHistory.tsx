import { useState } from 'react'
import { writeClipboard } from '../lib/clipboard'
import type { ClipboardEntry } from '../types'

interface ClipboardHistoryProps {
  entries: ClipboardEntry[]
  onClear: () => void
}

function formatTime(timestamp: number): string {
  const delta = Date.now() - timestamp
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp)
}

export function ClipboardHistory({ entries, onClear }: ClipboardHistoryProps) {
  const [copiedId, setCopiedId] = useState('')
  const [expandedId, setExpandedId] = useState('')
  const [confirming, setConfirming] = useState(false)

  async function copyEntry(entry: ClipboardEntry): Promise<void> {
    const result = await writeClipboard(entry.image ?? entry.text)
    if (result.ok) {
      setCopiedId(entry.id)
      window.setTimeout(() => setCopiedId(''), 1600)
    }
  }

  function handleClear(): void {
    if (!confirming) {
      setConfirming(true)
      window.setTimeout(() => setConfirming(false), 3000)
      return
    }
    setConfirming(false)
    onClear()
  }

  return (
    <section className="history-section" aria-labelledby="history-title">
      <div className="section-heading"><div><p className="eyebrow">Your local trail</p><h2 id="history-title">Clipboard history</h2></div><div className="heading-actions"><span className="count-label">{entries.length} / 100</span>{entries.length > 0 ? <button className="clear-button" type="button" onClick={handleClear}>{confirming ? 'Confirm?' : 'Clear history'}</button> : null}</div></div>
      {entries.length === 0 ? <div className="empty-history"><span className="empty-mark" aria-hidden="true">⌁</span><strong>Your shared text will land here.</strong><p>Send a snippet above to start building a history on both screens.</p></div> : <div className="history-list">{entries.map((entry) => { const isLong = (entry.text?.length ?? 0) > 240; const isExpanded = expandedId === entry.id; return <article className="history-item" key={entry.id}><div className="history-meta"><span className={`source-tag source-tag--${entry.source === 'this device' ? 'local' : 'remote'}`}>{entry.source === 'this device' ? 'This device' : 'Other device'}</span><time dateTime={new Date(entry.createdAt).toISOString()}>{formatTime(entry.createdAt)}</time></div>{entry.kind === 'image' && entry.image ? <div className="history-image-wrap"><img className="history-image" src={entry.image} alt="Shared image" /></div> : <p className={`history-text ${isLong && !isExpanded ? 'is-truncated' : ''}`}>{entry.text}</p>}<div className="history-actions">{isLong ? <button className="text-button" type="button" onClick={() => setExpandedId(isExpanded ? '' : entry.id)}>{isExpanded ? 'Show less' : 'Show all'}</button> : null}<button className="copy-button" type="button" onClick={() => copyEntry(entry)}>{copiedId === entry.id ? 'Copied' : 'Copy'} <span aria-hidden="true">{copiedId === entry.id ? '✓' : '↗'}</span></button></div></article> })}</div>}
    </section>
  )
}
