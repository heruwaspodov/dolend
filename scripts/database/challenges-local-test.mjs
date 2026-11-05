import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to anon,authenticated,service_role;
    create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,email text default 'fixture@example.com',email_confirmed_at timestamptz default now(),raw_app_meta_data jsonb default '{"provider":"google","providers":["google"]}',raw_user_meta_data jsonb default '{}',deleted_at timestamptz,banned_until timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant execute on function auth.uid() to public;`);
  for (const file of (await readdir('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(await readFile('supabase/tests/challenges.sql', 'utf8'));
  await db.exec(await readFile('supabase/tests/achievements.sql', 'utf8'));
  console.log('PASS challenge/achievement migrations and rollback regression tests');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error && typeof error === 'object' && 'where' in error) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
