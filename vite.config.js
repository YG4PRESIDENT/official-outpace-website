import { defineConfig } from 'vite'

export default defineConfig({
  base: '/official-outpace-website/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
      },
    },
  },
})
