import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyDiscounts, priceCart } from '../src/engine/discountEngine.js'
import { parseCartCSV, parseRulesCSV } from '../src/engine/csvParser.js'
import { extractTableRows } from '../src/engine/pdfRows.js'
import { validateRule } from '../src/engine/validation.js'
const rules = parseRulesCSV(readFileSync('sample-data/rules.csv', 'utf8')).data
const cart = parseCartCSV(readFileSync('sample-data/cart.csv', 'utf8')).data

test('assignment sample: item prices, separate cart offer and final total', () => {
  assert.equal(rules.length, 4)
  const result = priceCart(cart, rules)
  assert.deepEqual(
    result.items.map((i) => i.finalPrice),
    [1104, 629, 509, 2499, 382, 809],
  )
  assert.equal(result.subtotal, 5932)
  assert.equal(result.total, 5339)
  assert.equal(result.cartOffers[0].saving, 593)
  assert.equal(result.items[3].reasoning, 'No offers available')
  assert.deepEqual(result.items[0].appliedRules, ['RULE-01'])
  assert.deepEqual(result.items[1].appliedRules, ['RULE-02', 'RULE-03'])
})
test('cart threshold uses discounted subtotal, inclusive; below it no row appears', () => {
  const item = { ...cart[0], basePrice: 4000 }
  assert.equal(priceCart([item], [rules[3]]).total, 3600)
  assert.equal(
    priceCart([{ ...item, basePrice: 3999 }], [rules[3]]).cartOffers.length,
    0,
  )
  assert.equal(priceCart([item], [rules[0], rules[3]]).cartOffers.length, 0)
  assert.equal(priceCart([], rules).total, 0)
})
test('discounts are capped at zero, stackable offers work independently, ties are stable', () => {
  assert.equal(
    applyDiscounts({ ...cart[1], basePrice: 50 }, rules).finalPrice,
    0,
  )
  assert.equal(applyDiscounts(cart[5], rules).finalPrice, 809)
  const flat = { ...rules[1], value: 195 }
  assert.equal(
    applyDiscounts(cart[0], [rules[0], flat]).appliedRules[0],
    'RULE-01',
  )
})
test('multiple cart offers compete and stack; eligibility uses original subtotal', () => {
  const result = priceCart(cart, [
    rules[3],
    { ...rules[3], ruleId: 'B', value: 20 },
    { ...rules[3], ruleId: 'C', stackable: true, minCartValue: 7000 },
  ])
  assert.deepEqual(
    result.cartOffers.map((r) => r.ruleId),
    ['B'],
  )
})
test('CSV rejects invalid booleans, percentages, duplicate IDs, partial imports and junk prices', () => {
  assert.ok(
    parseRulesCSV(
      'rule_id,scope,applies_to,type,value,stackable\nA,brand,X,percentage,110,false',
    ).errors.length,
  )
  assert.ok(
    parseRulesCSV(
      'rule_id,scope,applies_to,type,value,stackable\nA,brand,X,flat,1,maybe',
    ).errors.length,
  )
  assert.equal(
    parseCartCSV(
      readFileSync('sample-data/cart.csv', 'utf8') +
        '\nITEM-01,Bad,X,Y,123oops',
    ).data.length,
    0,
  )
  assert.throws(() => validateRule({ ...rules[3], minCartValue: null }))
})
function pdfPage(rows) {
  return [['Product', 'Brand', 'Platform', 'Base Price'], ...rows].flatMap(
    (row, n) =>
      row.map((text, i) => ({
        text,
        x: [40, 200, 340, 460][i],
        y: 700 - n * 24,
        width: 80,
      })),
  )
}
test('PDF table preserves multiword fields and replaces IDs across pages', () => {
  const result = extractTableRows([
    pdfPage([['Cushion Cover', 'Natura Casa', 'Amazon India', 'Rs.1,299']]),
    pdfPage([['Bed Sheet Set', 'Natura Casa', 'Flipkart', '₹849']]),
  ])
  assert.deepEqual(result.errors, [])
  assert.equal(result.data[0].basePrice, 1299)
  assert.equal(result.data[1].itemId, 'ITEM-02')
})
test('malformed PDF rows and scanned PDFs fail atomically', () => {
  assert.equal(
    extractTableRows([pdfPage([['Vase', '', 'Noon', '2499']])]).data.length,
    0,
  )
  assert.match(extractTableRows([[]]).errors[0], /No cart table/)
})
