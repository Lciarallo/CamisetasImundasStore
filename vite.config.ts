import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-css-plugin',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;
      let newHtml = html;
      for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
        if (fileName.endsWith('.css') && 'source' in chunk) {
          const cssContent =
            typeof chunk.source === 'string'
              ? chunk.source
              : new TextDecoder().decode(chunk.source);
          newHtml = newHtml.replace(
            new RegExp(`<link[^>]*href="[^"]*${fileName}"[^>]*>`, 'g'),
            `<style>${cssContent}</style>`,
          );
        }
      }
      return newHtml;
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), inlineCssPlugin()],
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) {
            return 'firebase-vendor';
          }
        },
      },
    },
  },
});
