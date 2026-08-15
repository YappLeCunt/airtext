import type { DeviceKind } from '../types'

interface ModeChooserProps {
  current: DeviceKind | null
  preferred: DeviceKind
  onChoose: (device: DeviceKind) => void
}

export function ModeChooser({ current, preferred, onChoose }: ModeChooserProps) {
  return (
    <section className="mode-chooser" aria-labelledby="mode-title">
      <div>
        <p className="eyebrow">One clipboard, two screens</p>
        <h1 id="mode-title">Move text without emailing it to yourself.</h1>
        <p className="lede">Open airtext on your computer and phone. Pair once, then keep a small, private clipboard between them.</p>
      </div>
      <div className="mode-options" role="group" aria-label="Choose your device">
        <button className={`mode-option ${current === 'desktop' ? 'is-selected' : ''}`} type="button" onClick={() => onChoose('desktop')}>
          <span className="mode-icon" aria-hidden="true">⌘</span>
          <span><strong>Use this computer</strong><small>{preferred === 'desktop' ? 'Recommended on this device' : 'Show a pairing code'}</small></span>
          <span className="mode-arrow" aria-hidden="true">→</span>
        </button>
        <button className={`mode-option ${current === 'phone' ? 'is-selected' : ''}`} type="button" onClick={() => onChoose('phone')}>
          <span className="mode-icon" aria-hidden="true">⌁</span>
          <span><strong>Use this phone</strong><small>{preferred === 'phone' ? 'Recommended on this device' : 'Scan or enter a code'}</small></span>
          <span className="mode-arrow" aria-hidden="true">→</span>
        </button>
      </div>
      <p className="privacy-note"><span aria-hidden="true">◌</span> Text stays in your two browsers. Rooms expire when you leave.</p>
    </section>
  )
}
