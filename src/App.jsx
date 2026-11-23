import { useMemo, useState } from 'react'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import FileUploader from './components/FileUploader.jsx'
import RuleInput from './components/RuleInput.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { priceCart } from './engine/discountEngine.js'
import sampleRules from '../sample-data/rules.csv?raw'
import sampleCart from '../sample-data/cart.csv?raw'
const money = (value) => `₹${value.toLocaleString('en-IN')}`
const RULE_COLUMNS = [
  { key: 'ruleId', label: 'Rule' },
  { key: 'scope', label: 'Scope' },
  { key: 'appliesTo', label: 'Applies to', render: (v) => v || 'Entire cart' },
  {
    key: 'value',
    label: 'Offer',
    render: (v, r) =>
      r.type === 'percentage' ? `${v}% off` : `${money(v)} off`,
  },
  { key: 'stackable', label: 'Stacks', render: (v) => (v ? 'Yes' : 'No') },
  {
    key: 'minCartValue',
    label: 'Minimum cart',
    render: (v) => (v == null ? '—' : money(v)),
  },
]
const CART_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'brand', label: 'Brand' },
  { key: 'platform', label: 'Platform' },
  { key: 'basePrice', label: 'Base price', render: money },
]
const RESULT_COLUMNS = [
  {
    key: 'product',
    label: 'Product',
    render: (v, r) => (
      <>
        <strong>{v}</strong>
        <small>
          {r.itemId} · {r.platform}
        </small>
      </>
    ),
  },
  { key: 'basePrice', label: 'Base price', render: money },
  {
    key: 'finalPrice',
    label: 'Final price',
    render: (v) => <strong>{money(v)}</strong>,
  },
  {
    key: 'totalDiscount',
    label: 'You save',
    render: (v) => <span className="saving">{v ? money(v) : '—'}</span>,
  },
  {
    key: 'reasoning',
    label: 'Your offer',
    render: (v) => (
      <span className={v === 'No offers available' ? 'muted' : ''}>{v}</span>
    ),
  },
]
export default function App() {
  const [rules, setRules] = useState([]),
    [cart, setCart] = useState([])
  const [rulesErrors, setRulesErrors] = useState([]),
    [cartErrors, setCartErrors] = useState([])
  const [rulesFile, setRulesFile] = useState('CSV · discount rules'),
    [cartFile, setCartFile] = useState('CSV or PDF · up to 10 MB')
  const [message, setMessage] = useState('')
  const summary = useMemo(() => priceCart(cart, rules), [cart, rules])
  async function load(file, kind) {
    const isRules = kind === 'rules'
    const setErrors = isRules ? setRulesErrors : setCartErrors
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error('File must be smaller than 10 MB.')
      if (!(isRules ? /\.csv$/i : /\.(csv|pdf)$/i).test(file.name))
        throw new Error(`Choose a ${isRules ? 'CSV' : 'CSV or PDF'} file.`)
      const parsed =
        !isRules && /\.pdf$/i.test(file.name)
          ? await (await import('./engine/pdfParser.js')).parseCartPDF(file)
          : (isRules ? parseRulesCSV : parseCartCSV)(await file.text())
      setErrors(parsed.errors)
      if (parsed.errors.length) return
      if (isRules) {
        setRules(parsed.data)
        setRulesFile(file.name)
      } else {
        setCart(parsed.data)
        setCartFile(file.name)
      }
      setMessage(`${file.name} loaded. Prices recalculated.`)
    } catch (error) {
      setErrors([error.message])
    }
  }
  function samples() {
    setRules(parseRulesCSV(sampleRules).data)
    setCart(parseCartCSV(sampleCart).data)
    setRulesFile('Sample rules loaded')
    setCartFile('Sample cart loaded')
    setRulesErrors([])
    setCartErrors([])
    setMessage('Sample cart and rules loaded. Prices recalculated.')
  }
  function addRule(rule) {
    const ids = new Set(rules.map((r) => r.ruleId))
    let n = 1
    while (ids.has(`CUSTOM-${String(n).padStart(2, '0')}`)) n++
    const ruleId = `CUSTOM-${String(n).padStart(2, '0')}`
    setRules((current) => [...current, { ...rule, ruleId }])
    setMessage(`${ruleId} added. Prices recalculated.`)
  }
  return (
    <>
      <header>
        <a href="#" className="logo">
          opptra<span>.</span>
        </a>
        <span className="header-label">DISCOUNT STUDIO</span>
        <span className="session">
          <i /> Session only
        </span>
      </header>
      <main>
        <div className="hero">
          <div>
            <span className="eyebrow">THE BETTER DEAL, EVERY TIME</span>
            <h1>
              Every offer.
              <br />
              <span>One best price.</span>
            </h1>
            <p>
              Bring your cart and offers together. See exactly what applies,
              <br className="desktop-break" /> what stacks, and how much you
              save.
            </p>
          </div>
          <button className="secondary" onClick={samples}>
            Try sample cart ↗
          </button>
        </div>
        <div className="workflow">
          <span>01 &nbsp; Load your data</span>
          <b>→</b>
          <span>02 &nbsp; Add an offer</span>
          <b>→</b>
          <span>03 &nbsp; See your savings</span>
        </div>
        <div role="status" className="status">
          {message ||
            'Ready when you are. Upload files or try the sample cart.'}
        </div>
        <div className="input-grid">
          <section className="card">
            <div className="section-head">
              <h2>
                <span className="step">01</span> Discount rules
              </h2>
              <span className="count">{rules.length} active</span>
            </div>
            <FileUploader
              label="Upload rules CSV"
              accept=".csv"
              detail={rulesFile}
              onFile={(file) => load(file, 'rules')}
            />
            <ErrorBanner errors={rulesErrors} />
            {rules.length > 0 && (
              <details open>
                <summary>Active offers</summary>
                <DataTable columns={RULE_COLUMNS} rows={rules} />
              </details>
            )}
          </section>
          <section className="card">
            <div className="section-head">
              <h2>
                <span className="step">02</span> Your cart
              </h2>
              <span className="count">{cart.length} items</span>
            </div>
            <FileUploader
              label="Upload cart CSV or PDF"
              accept=".csv,.pdf"
              detail={cartFile}
              onFile={(file) => load(file, 'cart')}
            />
            <ErrorBanner errors={cartErrors} />
            {cart.length > 0 && (
              <details>
                <summary>View imported items</summary>
                <DataTable columns={CART_COLUMNS} rows={cart} />
              </details>
            )}
            <p className="hint">
              PDF columns: Product, Brand, Platform, Base Price.
              <br />A successful upload replaces the cart and refreshes prices.
            </p>
          </section>
        </div>
        <RuleInput onConfirm={addRule} />
        <section className="card results">
          <div className="section-head">
            <div>
              <span className="eyebrow">YOUR CHECKOUT</span>
              <h2>Clear prices. Happy cart.</h2>
            </div>
            {cart.length > 0 && (
              <span className="savings-badge">
                You save {money(summary.savings)}
              </span>
            )}
          </div>
          {cart.length === 0 ? (
            <div className="empty">
              <span aria-hidden="true">⌑</span>
              <h3>Your next great deal starts here</h3>
              <p>Upload a cart to see item prices and available offers.</p>
              <button className="secondary" onClick={samples}>
                Load sample data
              </button>
            </div>
          ) : (
            <>
              <DataTable columns={RESULT_COLUMNS} rows={summary.items} />
              <div className="totals">
                <div>
                  <span>Subtotal after item offers</span>
                  <strong>{money(summary.subtotal)}</strong>
                </div>
                {summary.cartOffers.map((offer) => (
                  <div className="saving" key={offer.ruleId}>
                    <span>
                      Cart offer: {offer.value}% off · {offer.ruleId}
                    </span>
                    <strong>−{money(offer.saving)} saved</strong>
                  </div>
                ))}
                <div className="grand-total">
                  <span>Final cart total</span>
                  <strong>{money(summary.total)}</strong>
                </div>
                <small>
                  Offers update automatically. Prices rounded to the nearest
                  rupee.
                </small>
              </div>
            </>
          )}
        </section>
        <footer>
          <strong>opptra.</strong>
          <span>Better offers. Clearer checkout.</span>
          <span>
            All data stays in this session. Only offer descriptions are sent for
            AI parsing.
          </span>
        </footer>
      </main>
    </>
  )
}
