import { defineConfig } from 'vite';

// El popup es la única página de la extensión. `public/` (manifest e íconos) se copia tal cual a dist/.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: { input: 'popup.html' },
  },
});
