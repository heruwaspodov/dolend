import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeIndonesianPhone, PhoneValidationError } from './phone.ts';

test('format 08, +62, dan 62 menjadi identitas bisnis yang sama', () => {
  const inputs = ['0812 3456 7890', '+62 812-3456-7890', '6281234567890'];
  const normalized = inputs.map((input) => normalizeIndonesianPhone(input).normalized);
  assert.deepEqual(normalized, ['6281234567890', '6281234567890', '6281234567890']);
});

test('menghasilkan E.164 untuk adapter provider tanpa mengubah format database', () => {
  assert.deepEqual(normalizeIndonesianPhone('081234567890'), {
    normalized: '6281234567890',
    e164: '+6281234567890',
    display: '+62 812 3456 7890',
  });
});

test('menolak nomor asing, telepon rumah, karakter asing, dan nomor invalid', () => {
  for (const input of ['+6591234567', '021 555 1234', '0812abc', '0812']) {
    assert.throws(() => normalizeIndonesianPhone(input), PhoneValidationError);
  }
});
