import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: false, // WebXRの実機テストにはHTTPS(またはlocalhost)が必要。詳細はREADME参照
  },
});
