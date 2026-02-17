import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../www',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'pet-health-panel.js',
        assetFileNames: 'pet-health-panel.[ext]',
        format: 'iife',
      }
    }
  },
  base: '/pet_health_panel/'
})
