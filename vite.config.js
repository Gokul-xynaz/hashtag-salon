import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor-firebase';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('html2pdf.js')) return 'vendor-html2pdf';
            if (id.includes('react/') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            return 'vendor-core';
          }
        }
      }
    }
  }
})

