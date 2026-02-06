import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    base: '/', // Default for local development
  }

  // Only use the sub-path for production builds (GitHub Pages)
  if (command !== 'serve') {
    config.base = '/collab-editor/'
  }

  return config
})