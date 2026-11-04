import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Zwei Build-Modi:
//   npm run build         -> dist/client        (Container/Server-Modus, Backend liefert die Dateien aus)
//   npm run build:static  -> dist-static        (ohne Backend, relative Pfade, einbettbar per <iframe>)
export default defineConfig(({ mode }) => {
  const isStatic = mode === 'static'
  return {
    plugins: [react(), tailwindcss()],
    base: isStatic ? './' : '/',
    build: {
      outDir: isStatic ? 'dist-static' : 'dist/client',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: { '/api': 'http://localhost:3000' },
    },
  }
})
