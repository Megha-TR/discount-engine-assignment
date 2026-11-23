import { useState } from 'react'
import { validateRule } from '../engine/validation.js'

export default function RuleInput({ onConfirm }) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function parse(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setPreview(null)
    try {
      const response = await fetch('/api/parse-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: text }),
        signal: AbortSignal.timeout(30000),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || 'Could not parse this offer.')
      setPreview(validateRule(data.rule))
    } catch (err) {
      setError(
        err.name === 'TimeoutError'
          ? 'Parsing timed out. Please try again.'
          : err.message,
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card rule-input">
      <div className="section-head">
        <div>
          <span className="eyebrow">CREATE AN OFFER</span>
          <h2>Describe it. Review it. Apply it.</h2>
        </div>
        <span className="badge">AI assisted</span>
      </div>
      <p>
        Turn a plain-English offer into a rule. Nothing is added until you
        confirm.
      </p>
      <form onSubmit={parse}>
        <label htmlFor="description">Offer description</label>
        <textarea
          id="description"
          maxLength={2000}
          rows={3}
          disabled={busy}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setPreview(null)
            setError('')
          }}
          placeholder="e.g. 20% off for Natura Casa brand, stackable with other offers"
          required
        />
        <div className="form-actions">
          <small>
            Include an amount and a brand, platform, or cart minimum.
          </small>
          <button disabled={busy || !text.trim()}>
            {busy ? 'Parsing offer…' : 'Preview rule →'}
          </button>
        </div>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="confirmation" aria-live="polite">
          <h3>Review your new rule</h3>
          <dl>
            <div>
              <dt>Scope</dt>
              <dd>{preview.scope}</dd>
            </div>
            <div>
              <dt>Applies to</dt>
              <dd>{preview.appliesTo || 'Entire cart'}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{preview.type}</dd>
            </div>
            <div>
              <dt>Discount</dt>
              <dd>
                {preview.type === 'percentage'
                  ? `${preview.value}%`
                  : `₹${preview.value}`}
              </dd>
            </div>
            <div>
              <dt>Stackable</dt>
              <dd>{preview.stackable ? 'Yes' : 'No'}</dd>
            </div>
            {preview.scope === 'cart' && (
              <div>
                <dt>Minimum cart</dt>
                <dd>
                  ₹{preview.minCartValue.toLocaleString('en-IN')} (inclusive)
                </dd>
              </div>
            )}
          </dl>
          <div className="button-row">
            <button
              onClick={() => {
                onConfirm(preview)
                setPreview(null)
                setText('')
              }}
            >
              Confirm & add rule
            </button>
            <button className="secondary" onClick={() => setPreview(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
