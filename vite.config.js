import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  build: {
    // ─── CODE SPLITTING (fixes 466KB single chunk) ───
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    target: 'es2020',
    sourcemap: false, // SECURITY: no source maps in production
    chunkSizeWarningLimit: 150,
    assetsInlineLimit: 4096,
    // Minify aggressively
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // strip console.log in prod
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: { toplevel: true },
    },
  },

  server: { port: 5173, host: true },
  preview: { port: 4173 },
});
