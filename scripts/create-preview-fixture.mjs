import { mkdir, writeFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
await stat('out/event/index.html'); // A build must already exist before creating the fixture.
const id = randomUUID();
const data = {
  id, title: 'Jalan sore bareng Dolend', description: 'Contoh aktivitas untuk pratinjau Dolend. Ini bukan acara yang menerima pendaftaran.',
  starts_at: '2026-11-07T09:00:00Z', ends_at: '2026-11-07T10:00:00Z', timezone: 'Asia/Jakarta',
  capacity: 12, participants_count: 4, price_amount: 0, currency: 'IDR',
  venue: { name: 'Taman kota · lokasi contoh', address: 'Jakarta, Indonesia · lokasi contoh', maps_url: 'https://www.google.com/maps/search/?api=1&query=Jakarta%20Indonesia' },
};
await mkdir('out/__poc/events', { recursive: true });
await writeFile(`out/__poc/events/${id}.json`, JSON.stringify({ data })+'\n');
await writeFile('.firebase-preview-fixture.json', JSON.stringify({ id, created_after_build: true, created_at: new Date().toISOString() })+'\n');
console.log(`Created public preview fixture after build: /event/?id=${id}`);
