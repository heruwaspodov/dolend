import { createPocApp } from './app.ts';
const app = createPocApp({
  url: Deno.env.get('SUPABASE_URL')!,
  publicKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  runToken: Deno.env.get('DOLEND_POC_RUN_TOKEN') ?? '',
  webhookSecret: Deno.env.get('DOLEND_POC_WEBHOOK_SECRET') ?? '',
});
Deno.serve(app.fetch);
