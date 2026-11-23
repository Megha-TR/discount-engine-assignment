import { parseNaturalRule, DEFAULT_GEMINI_MODEL } from '../server/ruleParser.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST.' })
  }
  try {
    let body = req.body
    if (typeof body === 'string') body = JSON.parse(body)
    const provider = process.env.LLM_PROVIDER || 'gemini'
    const rule = await parseNaturalRule(body?.description, {
      provider,
      apiKey:
        provider === 'gemini'
          ? process.env.GEMINI_API_KEY
          : process.env.OPENAI_API_KEY,
      model:
        provider === 'gemini'
          ? process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
          : process.env.OPENAI_MODEL || 'gpt-4o-mini',
    })
    return res.status(200).json({ rule })
  } catch (error) {
    return res
      .status(error.status || (error instanceof SyntaxError ? 400 : 502))
      .json({
        error:
          error.name === 'TimeoutError'
            ? 'Rule parsing timed out. Please try again.'
            : error.message,
      })
  }
}
