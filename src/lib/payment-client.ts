export async function paymentRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi pembayaran belum tersedia.');
  const response = await fetch(`${base}${path}`, { ...init, headers: { apikey:key, ...(token && !token.startsWith('sb_') ? {authorization:`Bearer ${token}`} : {}), ...(typeof init.body === 'string' ? {'content-type':'application/json'} : {}), ...init.headers }, cache:'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? 'Pembayaran belum dapat diakses.');
  return result.data as T;
}
