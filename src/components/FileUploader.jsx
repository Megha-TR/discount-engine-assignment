import { useRef, useState } from 'react'
export default function FileUploader({ label, accept, onFile, detail }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  async function load(file) {
    if (!file || busy) return
    setBusy(true)
    try {
      await onFile(file)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      className="upload"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        load(e.dataTransfer.files[0])
      }}
    >
      <input
        ref={ref}
        aria-label={label}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          load(e.target.files[0])
          e.target.value = ''
        }}
      />
      <span className="file-icon" aria-hidden="true">
        ↥
      </span>
      <div>
        <strong>{label}</strong>
        <small>{busy ? 'Reading file…' : detail}</small>
      </div>
      <button
        className="secondary"
        disabled={busy}
        onClick={() => ref.current?.click()}
      >
        {busy ? 'Reading…' : 'Choose file'}
      </button>
    </div>
  )
}
