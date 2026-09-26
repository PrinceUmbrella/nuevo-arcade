import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js + R3F make a single ~1.2 MB bundle; fine for a locally served kiosk game.
    chunkSizeWarningLimit: 1600,
  },
})
