import jsQR from 'jsqr'

// Camera-backed QR scanning built on jsQR. html5-qrcode's vendored zxing
// silently fails to decode some perfectly valid symbols (payload/mask
// dependent), which made pairing impossible for roughly half of all room
// codes; jsQR reads every symbol we could throw at it.

export interface QrScanHandle {
  stop: () => void
}

interface StartOptions {
  video: HTMLVideoElement
  /** Called at most once, on the first successful decode. */
  onDecode: (text: string) => void
  /** Called once when the camera cannot be started at all. */
  onError: (message: string) => void
}

const SCAN_INTERVAL_MS = 120

export function startQrScanning({ video, onDecode, onError }: StartOptions): QrScanHandle {
  let cancelled = false
  let stream: MediaStream | null = null
  let timer: number | undefined
  let finished = false

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  function finish(): void {
    if (finished) return
    finished = true
    if (timer !== undefined) window.clearInterval(timer)
    timer = undefined
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })
    .then((mediaStream) => {
      if (cancelled) {
        mediaStream.getTracks().forEach((track) => track.stop())
        return
      }
      stream = mediaStream
      video.srcObject = mediaStream
      video.setAttribute('playsinline', 'true')
      void video.play().catch(() => onError('The camera preview could not start. Enter the room code instead.'))
      timer = window.setInterval(() => {
        if (finished || video.readyState < video.HAVE_ENOUGH_DATA || !ctx || !video.videoWidth) return
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (found?.data && !finished) {
          finished = true
          window.clearInterval(timer)
          timer = undefined
          stream?.getTracks().forEach((track) => track.stop())
          stream = null
          onDecode(found.data)
        }
      }, SCAN_INTERVAL_MS)
    })
    .catch(() => {
      if (!cancelled) onError('Camera access is unavailable. Enter the room code instead.')
    })

  return {
    stop: () => {
      cancelled = true
      finish()
    },
  }
}
