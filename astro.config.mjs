import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
    imageService: 'compile',
    mode: 'advanced',
  }),
  vite: {
    define: {
      'process.env.DATABASE_ID': JSON.stringify(process.env.DATABASE_ID),
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
