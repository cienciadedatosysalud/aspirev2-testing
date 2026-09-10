// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
      plugins: [tailwindcss()],
      // server: {
      //   proxy: {
      //     '/api': {
      //       target: 'http://127.0.0.1:8000',
      //       changeOrigin: true,
      //       secure: false, // Añade esta línea
      //       //rewrite: (path) => path.replace(/^\/api/, ''),
      //     },
      //   },
      // },
    },
  
});