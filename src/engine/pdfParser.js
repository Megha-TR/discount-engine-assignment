import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { extractTableRows } from './pdfRows.js'
GlobalWorkerOptions.workerSrc = workerUrl

export async function parseCartPDF(file) {
  if (file.size > 10 * 1024 * 1024)
    return { data: [], errors: ['PDF must be smaller than 10 MB.'] }
  let task
  try {
    task = getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
    })
    const pdf = await task.promise
    if (pdf.numPages > 30) throw new Error('PDF must contain at most 30 pages.')
    const pages = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      pages.push(
        content.items
          .filter((i) => i.str?.trim())
          .map((i) => ({
            text: i.str,
            x: i.transform[4],
            y: i.transform[5],
            width: i.width,
          })),
      )
    }
    return extractTableRows(pages)
  } catch (error) {
    return {
      data: [],
      errors: [
        error.name === 'PasswordException'
          ? 'Password-protected PDFs are not supported.'
          : `Could not read cart PDF: ${error.message}`,
      ],
    }
  } finally {
    if (task) await task.destroy()
  }
}
