/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Build output goes to <repo>/life-os so GitHub Pages serves it at /portfolio/life-os/.
const outDir = fileURLToPath(new URL('../../life-os', import.meta.url));

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Only Latin font subsets are needed for Portuguese; others still load on demand when online.
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        rollupFormat: 'es',
      },
      manifest: {
        id: './',
        name: 'Ritmora',
        short_name: 'Ritmora',
        description: 'Seu sistema pessoal de organização: hábitos, metas, faculdade, agenda e lembretes.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0B0D',
        theme_color: '#0A0B0D',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Registrar hábito', url: './#/?quick=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Faculdade', url: './#/faculdade', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      devOptions: { enabled: false, type: 'module' },
    }),
  ],
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        // Avoid file names starting with "_" (GitHub Pages/Jekyll ignores them).
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
