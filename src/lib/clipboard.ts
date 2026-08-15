export type ClipboardResult =
  | { ok: true }
  | { ok: false; code: 'unavailable' | 'denied' | 'failed'; message: string }

export async function writeClipboard(text: string): Promise<ClipboardResult> {
  if (!navigator.clipboard?.writeText) {
    return { ok: false, code: 'unavailable', message: 'Clipboard access is not available in this browser.' }
  }
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch {
    return { ok: false, code: 'denied', message: 'Clipboard permission was blocked. Allow access and try again.' }
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function clipboardErrorForSend(error: unknown): string {
  return error instanceof Error ? error.message : 'The clipboard item could not be shared.'
}
