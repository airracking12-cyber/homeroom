import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { missingBuildEnv, buildEnvMessage } from './tools/build-env.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // A production build without the Supabase settings used to "succeed" and produce a blank site. Stop it instead.
  if (command === 'build') {
    const missing = missingBuildEnv(loadEnv(mode, process.cwd(), 'VITE_'))
    if (missing.length) throw new Error(buildEnvMessage(missing))
  }
  return { plugins: [react()] }
})
