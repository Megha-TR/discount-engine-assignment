import { parseMoney, validateItem } from './validation.js'

// Work from column coordinates rather than guessing multi-word brands/products.
export function extractTableRows(pages) {
  const data = [],
    errors = []
  let columns = null,
    foundHeader = false
  for (const [pageIndex, entries] of pages.entries()) {
    const lines = []
    for (const entry of [...entries].sort((a, b) => b.y - a.y || a.x - b.x)) {
      let line = lines.find((l) => Math.abs(l.y - entry.y) < 3)
      if (!line) {
        line = { y: entry.y, cells: [] }
        lines.push(line)
      }
      line.cells.push(entry)
    }
    for (const line of lines) {
      const cells = line.cells.sort((a, b) => a.x - b.x)
      const text = cells
        .map((c) => c.text)
        .join(' ')
        .trim()
      if (/product\s+brand\s+platform\s+base\s*price/i.test(text)) {
        const anchors = ['product', 'brand', 'platform', 'base'].map((word) => {
          for (const cell of cells) {
            const match = new RegExp(`\\b${word}\\b`, 'i').exec(cell.text)
            if (match)
              return (
                cell.x +
                (match.index / Math.max(1, cell.text.length)) * cell.width
              )
          }
          return undefined
        })
        if (anchors.every(Number.isFinite)) {
          columns = anchors
          foundHeader = true
        }
        continue
      }
      if (
        !columns ||
        !text ||
        /^[-─\s]+$/.test(text) ||
        /^(?:page\s+\d|total\b|subtotal\b|order\s*#|date\s*:)/i.test(text)
      )
        continue
      const values = ['', '', '', '']
      for (const cell of cells) {
        // PDF table cells are separate text runs in the supported format.
        let col = 0
        for (let i = 1; i < 4; i++) if (cell.x >= columns[i] - 6) col = i
        values[col] += `${values[col] ? ' ' : ''}${cell.text.trim()}`
      }
      try {
        const [product, brand, platform, price] = values
        data.push(
          validateItem({
            itemId: `ITEM-${String(data.length + 1).padStart(2, '0')}`,
            product,
            brand,
            platform,
            basePrice: parseMoney(price),
          }),
        )
      } catch (error) {
        errors.push(
          `Page ${pageIndex + 1}, table row "${text.slice(0, 90)}": ${error.message}`,
        )
      }
    }
  }
  if (!foundHeader)
    errors.push(
      'No cart table found. Use columns: Product, Brand, Platform, Base Price. Scanned PDFs require OCR and are not supported.',
    )
  else if (!data.length && !errors.length)
    errors.push('The cart table contains no items.')
  return { data: errors.length ? [] : data, errors }
}
