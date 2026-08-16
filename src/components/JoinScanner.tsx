import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { parseInvite } from '../lib/roomClient'
import { ConnectionStatus } from './ConnectionStatus'
import type { RoomStatus } from '../types'

interface JoinScannerProps {
  status: RoomStatus
  initialCode?: string
  errorMessage?: string
  onConnect: (code: string) => void
  onReset: () => void
}

export function JoinScanner({ status, initialCode = '', errorMessage, onConnect, onReset }: JoinScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [code, setCode] = useState(initialCode)
  const [cameraError, setCameraError] = useState('')
  const [showManual, setShowManual] = useState(Boolean(initialCode))
  const onConnectRef = useRef(onConnect)
  const autoJoinedRef = useRef(false)
  const joinedRef = useRef(false)

  useEffect(() => {
    onConnectRef.current = onConnect
  }, [onConnect])

  useEffect(() => {
    if (initialCode) {
      if (!autoJoinedRef.current) {
        autoJoinedRef.current = true
        onConnectRef.current(initialCode)
      }
      return
    }
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, (decoded) => {
      const parsed = parseInvite(decoded)
      if (!parsed) {
        setCameraError('That code is not an airtext room.')
        return
      }
      // The decode callback fires on every frame while the code is in view and
      // stop() is async, so guard against joining the same room repeatedly.
      if (joinedRef.current) return
      joinedRef.current = true
      onConnectRef.current(parsed)
      setCode(parsed)
      scanner.stop().catch(() => undefined)
    }, () => undefined).catch(() => {
      setCameraError('Camera access is unavailable. Enter the room code instead.')
      setShowManual(true)
    })
    return () => {
      try {
        scanner.stop().catch(() => undefined)
      } catch {
        // Already stopped or never started; nothing to tear down.
      }
    }
  }, [initialCode])

  function submitCode(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const parsed = parseInvite(code)
    if (parsed && !joinedRef.current) {
      joinedRef.current = true
      onConnect(parsed)
    } else if (!parsed) {
      setCameraError('Enter the 8-character code shown on the computer.')
    }
  }

  return (
    <section className="join-shell" aria-labelledby="join-title">
      <div className="join-header">
        <ConnectionStatus status={status} onReset={onReset} />
        <p className="eyebrow">Phone join</p>
        <h1 id="join-title">Point your camera at the computer.</h1>
        <p className="lede">Your phone is the quick side of the connection. Nothing is saved to an account.</p>
      </div>
      <div className="scanner-panel">
        <div className="scanner-window"><div id="qr-reader" aria-label="QR code scanner" /><div className="scanner-corner scanner-corner--tl" /><div className="scanner-corner scanner-corner--tr" /><div className="scanner-corner scanner-corner--bl" /><div className="scanner-corner scanner-corner--br" /></div>
        <div className="scanner-message"><span className="pulse-dot" aria-hidden="true" /> Looking for a room code</div>
        {(cameraError || errorMessage) ? <p className="error-message" role="alert">{errorMessage ?? cameraError}</p> : null}
        <button className="text-button center-button" type="button" onClick={() => setShowManual((value) => !value)}>{showManual ? 'Use camera instead' : 'Enter a code instead'}</button>
        {showManual ? <form className="manual-code-form" onSubmit={submitCode}><label htmlFor="room-code">Room code</label><div className="manual-code-row"><input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} inputMode="text" autoComplete="one-time-code" maxLength={9} placeholder="AB12 CD34" /><button className="primary-button" type="submit">Join room</button></div></form> : null}
      </div>
    </section>
  )
}
