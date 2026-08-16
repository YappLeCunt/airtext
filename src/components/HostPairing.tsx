import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import type { RoomStatus } from '../types'
import { roomInviteUrl } from '../types'
import { ConnectionStatus } from './ConnectionStatus'

interface HostPairingProps {
  code: string
  status: RoomStatus
  onConnect: (code: string) => void
  onReset: () => void
}

export function HostPairing({ code, status, onConnect, onReset }: HostPairingProps) {
  const [qrData, setQrData] = useState('')
  const [copied, setCopied] = useState(false)
  const onConnectRef = useRef(onConnect)

  useEffect(() => {
    onConnectRef.current = onConnect
  }, [onConnect])

  useEffect(() => {
    QRCode.toDataURL(roomInviteUrl(code), { width: 280, margin: 1, color: { dark: '#1e2927', light: '#fffdf8' } }).then((data) => {
      setQrData(data)
    })
  }, [code])

  async function copyCode(): Promise<void> {
    await navigator.clipboard?.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  function startPairing(): void {
    if (code) onConnect(code)
  }

  return (
    <section className="pairing-shell" aria-labelledby="host-title">
      <div className="pairing-copy">
        <ConnectionStatus status={status} onReset={onReset} />
        <p className="eyebrow">Computer host</p>
        <h1 id="host-title">Scan this from your phone.</h1>
        <p className="lede">Keep this tab open. Your phone will join this temporary room and everything you share will appear below.</p>
        <div className="steps" aria-label="Pairing steps">
          <div className="step is-active"><span>01</span><p><strong>Open the camera</strong><small>Point it at the code on this screen.</small></p></div>
          <div className="step"><span>02</span><p><strong>Share from either device</strong><small>Each new item stays in local history.</small></p></div>
        </div>
      </div>
      <div className="qr-panel">
        <div className="qr-frame">
          {qrData ? <img src={qrData} alt={`QR code to join room ${code}`} /> : <div className="qr-loading">Preparing room…</div>}
        </div>
        <div className="code-block">
          <span className="label">Or enter this 8-character code</span>
          <div className="code-row"><strong>{code.slice(0, 4)} {code.slice(4)}</strong><button className="icon-button" type="button" onClick={copyCode} aria-label="Copy room code">{copied ? '✓' : '⧉'}</button></div>
        </div>
        <button className="primary-button full-width" type="button" onClick={startPairing}>{status === 'connected' ? 'Open clipboard' : 'Start room'}</button>
        <p className="micro-copy">The room closes automatically after 30 minutes of inactivity.</p>
      </div>
    </section>
  )
}
