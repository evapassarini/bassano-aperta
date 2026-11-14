import { defineConfig } from 'vite';

// "base" relativo: il sito costruito funziona da qualunque cartella (anche in una sottocartella).
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});
