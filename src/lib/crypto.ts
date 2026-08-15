const IV_BYTES = 12
const PBKDF2_ITERATIONS = 100_000

export class RoomCrypto {
  private readonly key: Promise<CryptoKey>

  constructor(code: string) {
    this.key = this.deriveKey(code)
  }

  private async deriveKey(code: string): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey'])
    const salt = new TextEncoder().encode(`airtext-room:${code}`)
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    )
  }

  async encrypt(plaintext: string): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
    const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(IV_BYTES)))
    const key = await this.key
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
    return { iv, ciphertext }
  }

  async decrypt(iv: Uint8Array<ArrayBuffer>, ciphertext: ArrayBuffer): Promise<string> {
    const key = await this.key
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(plaintext)
  }
}

// Encode/Decode binary data as base64 for transport, and wrap a ciphertext+iv pair.
function bytesToBase64(bytes: ArrayBuffer): string {
  let binary = ''
  const view = new Uint8Array(bytes)
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i])
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function ivToBase64(iv: Uint8Array): string {
  return bytesToBase64(iv.slice().buffer as ArrayBuffer)
}

export async function seal(crypto: RoomCrypto, plaintext: string): Promise<string> {
  const { iv, ciphertext } = await crypto.encrypt(plaintext)
  return `${ivToBase64(iv)}.${bytesToBase64(ciphertext)}`
}

export async function open(crypto: RoomCrypto, sealed: string): Promise<string | null> {
  if (typeof sealed !== 'string' || !sealed.includes('.')) return null
  const dot = sealed.indexOf('.')
  if (dot <= 0 || dot >= sealed.length - 1) return null
  try {
    const iv = base64ToBytes(sealed.slice(0, dot))
    const ciphertext = base64ToBytes(sealed.slice(dot + 1))
    return await crypto.decrypt(iv, ciphertext.buffer)
  } catch {
    return null
  }
}
