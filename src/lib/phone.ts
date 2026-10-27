import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export type IndonesianPhone = {
  normalized: string;
  e164: string;
  display: string;
};

export class PhoneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneValidationError';
  }
}

export function normalizeIndonesianPhone(input: string): IndonesianPhone {
  const raw = input.trim();
  if (!raw) throw new PhoneValidationError('Nomor WhatsApp wajib diisi.');
  if (!/^[+\d\s().-]+$/.test(raw)) {
    throw new PhoneValidationError('Gunakan angka dan pemisah nomor yang umum saja.');
  }

  const compact = raw.replace(/[\s().-]/g, '');
  if (!/^(?:0|\+?62)\d+$/.test(compact)) {
    throw new PhoneValidationError('Gunakan nomor Indonesia yang diawali 08, 62, atau +62.');
  }

  const candidate = compact.startsWith('62') ? `+${compact}` : compact;
  const phone = parsePhoneNumberFromString(candidate, 'ID');
  if (!phone?.isValid() || phone.country !== 'ID') {
    throw new PhoneValidationError('Nomor Indonesia ini tidak valid. Periksa kembali angkanya.');
  }
  if (phone.getType() !== 'MOBILE') {
    throw new PhoneValidationError('Gunakan nomor seluler Indonesia, bukan telepon rumah.');
  }

  return {
    normalized: phone.number.slice(1),
    e164: phone.number,
    display: phone.formatInternational(),
  };
}
