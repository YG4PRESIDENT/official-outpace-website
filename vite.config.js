import { defineConfig } from 'vite'
import { resolve } from 'node:path'
export default defineConfig({base:'./',build:{rollupOptions:{input:Object.fromEntries(['index','404','how-it-works','privacy','terms','rules','support','delete-account'].map(name=>[name,resolve(import.meta.dirname,`${name}.html`)]))}}})
