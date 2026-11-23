import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNaturalRule } from '../server/ruleParser.js'
import handler from '../api/parse-rule.js'
const rule = {
  error: null,
  scope: 'brand',
  appliesTo: 'Natura Casa',
  type: 'percentage',
  value: 20,
  stackable: true,
  minCartValue: null,
}
const fake =
  (obj, status = 'completed') =>
  async () => ({
    ok: true,
    json: async () => ({
      status,
      output: [
        { content: [{ type: 'output_text', text: JSON.stringify(obj) }] },
      ],
    }),
  })
test('structured LLM response is validated and request uses a strict schema', async () => {
  const result = await parseNaturalRule(
    '20% off Natura Casa brand, stackable',
    {
      provider: 'openai',
      apiKey: 'test',
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.openai.com/v1/responses')
        const request = JSON.parse(init.body)
        assert.equal(request.text.format.strict, true)
        assert.equal(request.store, false)
        return fake(rule)()
      },
    },
  )
  assert.equal(result.value, 20)
  assert.equal(result.stackable, true)
})
test('ambiguous input, bad rules, incomplete output, missing config and provider failures', async () => {
  const opts = (obj) => ({
    provider: 'openai',
    apiKey: 'test',
    fetchImpl: fake(obj),
  })
  await assert.rejects(
    parseNaturalRule(
      'big orders',
      opts({ error: 'Specify amount and threshold.' }),
    ),
    /threshold/,
  )
  await assert.rejects(
    parseNaturalRule('offer', opts({ ...rule, value: 101 })),
    /100/,
  )
  await assert.rejects(
    parseNaturalRule('offer', {
      provider: 'openai',
      apiKey: 'test',
      fetchImpl: fake(rule, 'incomplete'),
    }),
    /incomplete/,
  )
  await assert.rejects(parseNaturalRule('offer'), /not configured/)
  await assert.rejects(parseNaturalRule('', opts(rule)), /Describe/)
  await assert.rejects(
    parseNaturalRule('offer', {
      provider: 'openai',
      apiKey: 'test',
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    /busy/,
  )
  await assert.rejects(parseNaturalRule('offer', opts(null)), /invalid rule/)
})
test('API rejects unsupported methods and invalid JSON without exposing secrets', async () => {
  const res = {
    setHeader() {},
    status(code) {
      this.code = code
      return this
    },
    json(body) {
      this.body = body
    },
  }
  await handler({ method: 'GET' }, res)
  assert.equal(res.code, 405)
  await handler({ method: 'POST', body: '{' }, res)
  assert.equal(res.code, 400)
})

test('Gemini uses structured output and a private header, then validates the rule', async () => {
  const parsed = await parseNaturalRule(
    '20% off Natura Casa brand, stackable',
    {
      apiKey: 'private-test-key',
      fetchImpl: async (url, init) => {
        assert.match(
          url,
          /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\//,
        )
        assert.ok(!url.includes('private-test-key'))
        assert.equal(init.headers['x-goog-api-key'], 'private-test-key')
        const body = JSON.parse(init.body)
        assert.equal(body.generationConfig.responseMimeType, 'application/json')
        assert.equal(
          body.generationConfig.responseJsonSchema.additionalProperties,
          false,
        )
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(rule) }] },
              },
            ],
          }),
        }
      },
    },
  )
  assert.equal(parsed.scope, 'brand')
  assert.equal(parsed.value, 20)
})
test('Gemini blocks, incomplete output and invalid provider are handled explicitly', async () => {
  for (const result of [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'MAX_TOKENS' }] },
  ]) {
    await assert.rejects(
      parseNaturalRule('offer', {
        apiKey: 'test',
        fetchImpl: async () => ({ ok: true, json: async () => result }),
      }),
      /could not be parsed|incomplete/,
    )
  }
  await assert.rejects(
    parseNaturalRule('offer', { provider: 'unknown', apiKey: 'test' }),
    /LLM_PROVIDER/,
  )
  await assert.rejects(parseNaturalRule('offer'), /GEMINI_API_KEY/)
})
