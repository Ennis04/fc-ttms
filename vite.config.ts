import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Need to change proxy target when deploying
  server: {
  proxy: {
    '/ttms': {
      target: 'http://web.fc.utm.my',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/ttms/, '')
    }
  }
}

})
  