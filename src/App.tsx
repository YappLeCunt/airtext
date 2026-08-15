import { useEffect, useMemo, useState } from 'react'
import { ClipboardComposer } from './components/ClipboardComposer'
import { ClipboardHistory } from './components/ClipboardHistory'
import { ConnectionStatus } from './components/ConnectionStatus'
import { HostPairing } from './components/HostPairing'
import { JoinScanner } from './components/JoinScanner'
import { ModeChooser } from './components/ModeChooser'
import { createEntry, loadHistory, saveEntry } from './lib/historyStore'
import { preferredDevice } from './lib/device'
import { RoomClient, parseInvite } from './lib/roomClient'
import type { ClipboardEntry, DeviceKind, RoomStatus, ServerMessage } from './types'

function App() {
  const preferred = useMemo(() => preferredDevice(), [])
  const initialInvite = useMemo(() => new URLSearchParams(window.location.search).get('join') ?? '', [])
  const [device, setDevice] = useState<DeviceKind | null>(initialInvite ? 'phone' : null)
  const [roomCode, setRoomCode] = useState('')
  const [status, setStatus] = useState<RoomStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [history, setHistory] = useState<ClipboardEntry[]>([])
  const [client, setClient] = useState<RoomClient | null>(null)

  useEffect(() => {
    loadHistory().then(setHistory)
  }, [])

  useEffect(() => () => client?.close(), [client])

  function reset(): void {
    client?.close()
    setClient(null)
    setRoomCode('')
    setDevice(null)
    setStatus('idle')
    setStatusMessage('')
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname)
  }

  function connect(code: string, nextDevice = device ?? preferred): void {
    const parsed = parseInvite(code)
    if (!parsed) {
      setStatus('error')
      setStatusMessage('That room code is not valid.')
      return
    }
    client?.close()
    const nextClient = new RoomClient(parsed, nextDevice)
    nextClient.subscribe((event) => {
      if (event.type === 'status') {
        setStatus(event.status)
        setStatusMessage(event.message ?? '')
      } else handleServerMessage(event.message)
    })
    setClient(nextClient)
    setRoomCode(parsed)
    setDevice(nextDevice)
    nextClient.connect()
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname)
  }

  function handleServerMessage(message: ServerMessage): void {
    if (message.type !== 'clipboard-item') return
    const entry: ClipboardEntry = { id: message.id, text: message.text, createdAt: message.createdAt, source: 'other device' }
    saveEntry(entry).then(setHistory)
  }

  async function share(text: string): Promise<void> {
    if (!client || status !== 'connected') throw new Error('Connect both devices before sharing text.')
    const entry = createEntry(text, 'this device')
    setHistory(await saveEntry(entry))
    client.send({ type: 'clipboard-item', id: entry.id, text: entry.text, createdAt: entry.createdAt })
  }

  function workspace(): React.JSX.Element {
    return <main className="workspace-shell"><header className="workspace-header"><div><p className="eyebrow">Airtext room <span className="room-code-inline">{roomCode.slice(0, 4)} {roomCode.slice(4)}</span></p><h1>Clipboard, in sync.</h1></div><div className="workspace-actions"><ConnectionStatus status={status} onReset={reset} /><button className="secondary-button" type="button" onClick={reset}>Leave room</button></div></header><div className="workspace-grid"><div className="workspace-main"><ClipboardComposer onShare={share} /><ClipboardHistory entries={history} /></div><aside className="workspace-rail"><div className="rail-card"><span className="rail-kicker">Connected device</span><div className="device-line"><span className="device-orb" aria-hidden="true">{device === 'desktop' ? '⌁' : '⌘'}</span><div><strong>{device === 'desktop' ? 'Phone' : 'Computer'}</strong><small>Ready to receive</small></div><span className="online-dot" aria-label="Online" /></div><p>Share text from either screen. It will appear at the top of both histories.</p></div><div className="rail-note"><span aria-hidden="true">◌</span><p><strong>Private by default.</strong> This room is temporary. Your history is stored only in this browser.</p></div></aside></div></main>
  }

  if (status === 'connected') return workspace()
  return <main className="app-shell"><header className="app-header"><a className="wordmark" href="/" onClick={(event) => { event.preventDefault(); reset() }}>airtext<span>·</span></a><span className="header-note">A tiny bridge between screens</span></header>{device === null ? <ModeChooser current={device} preferred={preferred} onChoose={(next) => { setDevice(next); if (next === 'desktop') setStatus('idle') }} /> : device === 'desktop' ? <HostPairing status={status} onConnect={(code) => connect(code, 'desktop')} onReset={reset} /> : <JoinScanner status={status} initialCode={initialInvite} errorMessage={statusMessage} onConnect={(code) => connect(code, 'phone')} onReset={reset} />}{device !== null && !client ? <button className="back-button" type="button" onClick={reset}>← Choose another device</button> : null}</main>
}

export default App
