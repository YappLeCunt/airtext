import { useState } from 'react'
import { readClipboard } from '../lib/clipboard'

interface ClipboardComposerProps {
  onShare: (text: string) => Promise<void>
}

export function ClipboardComposer({ onShare }: ClipboardComposerProps) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  async function pasteFromClipboard(): Promise<void> {
    const result = await readClipboard()
    if (result.ok) {
      setText(result.text)
      setMessage('Pasted from this device.')
    } else setMessage(result.message)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!text.trim() || isSending) return
    setIsSending(true)
    setMessage('')
    try {
      await onShare(text)
      setText('')
      setMessage('Shared with your other device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not share this item.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-label-row"><label htmlFor="clipboard-text">Share a text snippet</label><button className="text-button" type="button" onClick={pasteFromClipboard}>Paste from clipboard</button></div>
      <textarea id="clipboard-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste a link, note, command, or anything you need on the other screen…" rows={4} />
      <div className="composer-footer"><span className="composer-hint">{message || 'Text only · up to 100,000 characters'}</span><button className="primary-button" type="submit" disabled={!text.trim() || isSending}>{isSending ? 'Sharing…' : 'Share text'} <span aria-hidden="true">↗</span></button></div>
    </form>
  )
}
