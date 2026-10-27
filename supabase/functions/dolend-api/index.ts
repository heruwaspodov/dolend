import { createApp } from './app.ts';
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const app = createApp({ allowedOrigins, pocMode: Deno.env.get('POC_MODE') === 'true' });
Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8000) }, app.fetch);
