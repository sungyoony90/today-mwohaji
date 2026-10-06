import { defineConfig } from 'vite';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Only approved web inputs are packaged. Never copy .env, Git, server code or docs.
export const bundleFiles = [
  'app.js', 'design-system.css', 'styles.css', 'home-prototype.css',
  'home-editorial.css', 'activity-editorial.css', 'browse-editorial.css', 'place-detail.css',
  'moment-editorial.css', 'my-editorial.css', 'saved-editorial.css', 'spot-catalog.js',
  'seasonal-catalog.js', 'activity-place-data.js', 'activity-extra-data.js',
  'activity-spa-data.js', 'activity-catalog.js', 'catalog-activity-audit-1.js',
  'catalog-activity-audit-2.js', 'catalog-activity-audit-3.js', 'crowd-forecast.js',
];

export default defineConfig(({ mode }) => ({
  envDir: false,
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: mode === 'demo' ? 'demo-runtime.js' : 'runtime-entry.js', name: 'MoaRuntime', formats: ['iife'], fileName: () => 'runtime.js' },
  },
  plugins: [{
    name: 'preserve-approved-prototype',
    async closeBundle() {
      await mkdir('dist', { recursive: true });
      await Promise.all(bundleFiles.map(file => copyFile(file, join('dist', file))));
      await cp('assets', 'dist/assets', { recursive: true });
      const html = (await readFile('index.html', 'utf8'))
        .replace('<title>오늘 뭐하지 · V2 Prototype</title>', '<title>오늘 뭐하지</title>');
      await writeFile('dist/index.html', html);
    },
  }],
}));
