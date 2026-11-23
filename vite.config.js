import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { ruleApiPlugin } from './server/devPlugin.js'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'LLM_PROVIDER',
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
  ])
    if (env[key]) process.env[key] = env[key]
  return { plugins: [react(), ruleApiPlugin()] }
})
