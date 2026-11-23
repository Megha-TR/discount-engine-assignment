// Shared validation for CSV adapters and the untrusted LLM response.
export function validateRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule))
    throw new Error('Expected a discount rule object.')
  const text = (value) => typeof value === 'string' && value.trim().length > 0
  if (!text(rule.ruleId)) throw new Error('Rule ID is required.')
  if (!['brand', 'platform', 'cart'].includes(rule.scope))
    throw new Error('Scope must be brand, platform, or cart.')
  if (rule.scope !== 'cart' && !text(rule.appliesTo))
    throw new Error('Specify the brand or platform this offer applies to.')
  if (!['flat', 'percentage'].includes(rule.type))
    throw new Error('Type must be flat or percentage.')
  if (!Number.isFinite(rule.value) || rule.value <= 0 || rule.value > 1e9)
    throw new Error('Discount value must be a positive, finite number.')
  if (rule.type === 'percentage' && rule.value > 100)
    throw new Error('Percentage cannot exceed 100%.')
  if (typeof rule.stackable !== 'boolean')
    throw new Error('Stackable must be true or false.')
  if (
    rule.scope === 'cart' &&
    (rule.type !== 'percentage' ||
      !Number.isFinite(rule.minCartValue) ||
      rule.minCartValue < 0 ||
      rule.minCartValue > 1e9)
  ) {
    throw new Error(
      'Cart offers require a percentage discount and a non-negative minimum cart value.',
    )
  }
  return {
    ruleId: rule.ruleId.trim(),
    scope: rule.scope,
    appliesTo: rule.scope === 'cart' ? '' : rule.appliesTo.trim(),
    type: rule.type,
    value: rule.value,
    stackable: rule.stackable,
    ...(rule.scope === 'cart' ? { minCartValue: rule.minCartValue } : {}),
  }
}

export function validateItem(item) {
  for (const field of ['itemId', 'product', 'brand', 'platform']) {
    if (typeof item[field] !== 'string' || !item[field].trim())
      throw new Error(`${field} is required.`)
  }
  if (
    !Number.isFinite(item.basePrice) ||
    item.basePrice < 0 ||
    item.basePrice > 1e9
  )
    throw new Error('Base price must be a finite, non-negative amount.')
  return { ...item, basePrice: Math.round(item.basePrice) }
}

export function parseMoney(value) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/^(?:Rs\.?|INR|₹)\s*/i, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{2,3})+)(?:\.\d{1,2})?$/.test(cleaned)) return NaN
  return Number(cleaned.replaceAll(',', ''))
}
