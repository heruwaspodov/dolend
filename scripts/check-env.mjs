import assert from 'node:assert/strict';

const projectRef = 'fpbefabsqryxmnmxufjw';
const projectOrigin = `https://${projectRef}.supabase.co`;
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_API_URL',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
];

for (const name of required) assert.ok(process.env[name]?.trim(), `${name} belum diisi di .env.local`);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, projectOrigin, 'NEXT_PUBLIC_SUPABASE_URL bukan project Dolend');
assert.equal(process.env.SUPABASE_URL, projectOrigin, 'SUPABASE_URL bukan project Dolend');
assert.equal(process.env.NEXT_PUBLIC_API_URL, `${projectOrigin}/functions/v1/dolend-api/v1`, 'NEXT_PUBLIC_API_URL tidak sesuai function Dolend');
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, process.env.SUPABASE_PUBLISHABLE_KEY, 'Public key browser dan API lokal harus sama');
assert.match(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, /^(sb_publishable_|eyJ)/, 'Publishable key tidak dikenali');
assert.equal(process.env.NEXT_PUBLIC_POC_EVENT_FIXTURES, 'false', 'Fixture POC harus nonaktif untuk development normal');
assert.equal(process.env.POC_MODE, 'false', 'Route POC harus nonaktif');
assert.ok(process.env.ALLOWED_ORIGINS?.split(',').includes('http://localhost:3000'), 'Origin frontend lokal belum diizinkan');

for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith('NEXT_PUBLIC_')) assert.ok(!/service_role|sb_secret_/i.test(value ?? ''), `${name} mengandung secret server`);
}

console.log('Environment Dolend valid: frontend, API lokal, dan project Supabase cocok.');
