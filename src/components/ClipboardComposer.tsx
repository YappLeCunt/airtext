import { useEffect, useState } from 'react'
import { blobToDataUrl } from '../lib/clipboard'
import { MAX_IMAGE_BYTES, MAX_TEXT_LENGTH } from '../types'

interface ClipboardComposerProps {
  onShare: (text: string, image?: string) => Promise<void>
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function PasteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

export function ClipboardComposer({ onShare }: ClipboardComposerProps) {
  const [text, setText] = useState('')
  const [image, setImage] = useState('')
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)

  function attachBlob(blob: Blob): void {
    if (blob.size > MAX_IMAGE_BYTES) {
      setMessage(`Image is too large. Keep it under ${MAX_IMAGE_BYTES / 1000} KB.`)
      return
    }
    blobToDataUrl(blob).then((dataUrl) => {
      setImage(dataUrl)
      setMessage('')
    }).catch(() => setMessage('Could not read that image.'))
  }

  // Catch Ctrl/⌘+V anywhere on the page, not just inside the textarea.
  useEffect(() => {
    function onWindowPaste(event: ClipboardEvent): void {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      const imageItem = Array.from(event.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'))
      if (!imageItem) return
      event.preventDefault()
      const blob = imageItem.getAsFile()
      if (blob) attachBlob(blob)
    }
    window.addEventListener('paste', onWindowPaste)
    return () => window.removeEventListener('paste', onWindowPaste)
  }, [])

  async function pasteFromClipboard(): Promise<void> {
    if (!navigator.clipboard?.read) {
      setMessage('Clipboard reading is not supported here. Use Ctrl/⌘+V instead.')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (imageType) {
          attachBlob(await item.getType(imageType))
          return
        }
      }
      const pastedText = await navigator.clipboard.readText()
      setText(pastedText)
      setMessage('Pasted from this device.')
    } catch {
      setMessage('Clipboard access was blocked. Allow it in browser settings, or use Ctrl/⌘+V.')
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): void {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    event.preventDefault()
    const blob = imageItem.getAsFile()
    if (blob) attachBlob(blob)
  }

  function pickImage(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage('Choose an image file.')
      return
    }
    attachBlob(file)
  }

  function clearImage(): void {
    setImage('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (isSending) return
    const hasContent = text.trim().length > 0 || Boolean(image)
    if (!hasContent) return
    setIsSending(true)
    setMessage('')
    try {
      await onShare(text, image || undefined)
      setText('')
      clearImage()
      setMessage('Shared with your other device.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not share this item.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-label-row">
        <label htmlFor="clipboard-text">Share a text snippet</label>
        <button className="text-button paste-button" type="button" onClick={pasteFromClipboard}><PasteIcon /> Paste from clipboard</button>
      </div>
      <textarea id="clipboard-text" value={text} onChange={(event) => setText(event.target.value)} onPaste={handlePaste} placeholder="Paste a link, note, command, or anything you need on the other screen…" rows={4} maxLength={MAX_TEXT_LENGTH} />
      {image ? <div className="image-preview"><img src={image} alt="Attached preview" /><button className="text-button" type="button" onClick={clearImage}>Remove image</button></div> : null}
      <div className="composer-footer">
        <span className="composer-hint">{message || 'Text or image · up to 100,000 characters / 350 KB images'}</span>
        <div className="composer-actions">
          <label className="media-button" title="Take a photo (under 350 KB)"><input type="file" accept="image/*" capture="environment" onChange={pickImage} hidden /><CameraIcon /> Camera</label>
          <label className="media-button" title="Choose from gallery (under 350 KB)"><input type="file" accept="image/*" onChange={pickImage} hidden /><GalleryIcon /> Gallery</label>
          <button className="primary-button" type="submit" disabled={(!text.trim() && !image) || isSending}>{isSending ? 'Sharing…' : 'Share text'} <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </form>
  )
}
