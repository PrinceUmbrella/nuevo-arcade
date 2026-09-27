import react from '@vitejs/plugin-react'
import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'

/**
 * This computer's address on the local network, preferring home/office ranges over VPN or
 * container adapters. The game uses it for the Navigator link, because a phone can't open a
 * "localhost" link copied from the kiosk.
 */
function lanAddress(): string | null {
  const addresses = Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((net) => net.family === 'IPv4' && !net.internal)
    .map((net) => net.address)
  const rank = (a: string) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : 3)
  return addresses.sort((a, b) => rank(a) - rank(b))[0] ?? null
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    // Only meaningful when the server listens on the network (npm run dev:lan, vite preview --host).
    __LAN_HOST__: JSON.stringify(command === 'serve' && process.argv.includes('--host') ? lanAddress() : null),
  },
  build: {
    // three.js + R3F make a single ~1.2 MB bundle; fine for a locally served kiosk game.
    chunkSizeWarningLimit: 1600,
  },
}))
