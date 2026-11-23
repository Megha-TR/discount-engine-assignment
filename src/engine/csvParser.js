import Papa from 'papaparse'
import { validateRule, validateItem, parseMoney } from './validation.js'

function parseCSV(text, required, convert, idKey) {
  const parsed = Papa.parse(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })
  const errors = parsed.errors.map((e) => `CSV: ${e.message}`)
  for (const key of required)
    if (!parsed.meta.fields?.includes(key))
      errors.push(`Missing column: ${key}`)
  if (!parsed.data.length) errors.push('The file contains no data rows.')
  if (errors.length) return { data: [], errors }
  const data = [],
    seen = new Set()
  parsed.data.forEach((row, i) => {
    try {
      const item = convert(row)
      if (seen.has(item[idKey])) throw new Error(`Duplicate ID: ${item[idKey]}`)
      seen.add(item[idKey])
      data.push(item)
    } catch (error) {
      errors.push(`Row ${i + 2}: ${error.message}`)
    }
  })
  // Atomic imports: never silently price a partial cart or partially loaded rules.
  return { data: errors.length ? [] : data, errors }
}

export function parseRulesCSV(text) {
  return parseCSV(
    text,
    ['rule_id', 'scope', 'applies_to', 'type', 'value', 'stackable'],
    (r) => {
      const boolean = r.stackable?.trim().toLowerCase()
      if (!['true', 'false', '1', '0', 'yes', 'no'].includes(boolean))
        throw new Error('Stackable must be true or false.')
      return validateRule({
        ruleId: r.rule_id,
        scope: r.scope?.trim().toLowerCase(),
        appliesTo: r.applies_to,
        type: r.type?.trim().toLowerCase(),
        value: Number(r.value?.trim() || NaN),
        stackable: ['true', '1', 'yes'].includes(boolean),
        minCartValue: r.min_cart_value?.trim()
          ? parseMoney(r.min_cart_value)
          : NaN,
      })
    },
    'ruleId',
  )
}

export function parseCartCSV(text) {
  return parseCSV(
    text,
    ['item_id', 'product', 'brand', 'platform', 'base_price'],
    (r) =>
      validateItem({
        itemId: r.item_id.trim(),
        product: r.product.trim(),
        brand: r.brand.trim(),
        platform: r.platform.trim(),
        basePrice: parseMoney(r.base_price),
      }),
    'itemId',
  )
}
