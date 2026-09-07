import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_VERSION']);
  for (const [name, value] of Object.entries({ ...env, ...process.env })) {
    if (!name.startsWith('VITE_')) continue;
    if (!allowed.has(name) || /(?:gsk_|sb_secret_)/.test(value)) throw new Error('Unexpected or secret VITE_ variable. Move provider credentials to the backend.');
    if (name === 'VITE_SUPABASE_ANON_KEY' && value.startsWith('eyJ')) {
      let role;
      try { role = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).role; } catch { throw new Error('Invalid public Supabase key.'); }
      if (role !== 'anon') throw new Error('A privileged Supabase key must never enter a frontend build.');
    }
  }
  return { plugins: [react()], build: { target: 'es2020', sourcemap: false },
    server: { port: 5173, host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3001' } },
    preview: { port: 4173, host: '127.0.0.1' } };
});
