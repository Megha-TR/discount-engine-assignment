import handler from '../api/parse-rule.js'
export function ruleApiPlugin() {
  return {
    name: 'rule-api',
    configureServer(server) {
      server.middlewares.use('/api/parse-rule', async (req, res) => {
        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (body) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          const chunks = []
          let size = 0
          for await (const chunk of req) {
            size += chunk.length
            if (size > 8192)
              return res.status(413).json({ error: 'Request is too large.' })
            chunks.push(chunk)
          }
          req.body = Buffer.concat(chunks).toString() || '{}'
          await handler(req, res)
        } catch {
          res.status(400).json({ error: 'Could not read request.' })
        }
      })
    },
  }
}
