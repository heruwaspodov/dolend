export const costModelOptions = [
  { value: 'dynamic', label: 'Patungan sesuai jumlah peserta', hint: 'Biaya total dibagi ke peserta yang ikut.' },
  { value: 'fixed', label: 'Patungan harga tetap', hint: 'Setiap peserta membayar nominal yang sama.' },
  { value: 'free', label: 'Gratis', hint: 'Peserta tidak perlu membayar.' },
] as const;

export const paymentTimingOptions = [
  { value: 'before_event', label: 'Sebelum event' },
  { value: 'after_event', label: 'Setelah event' },
] as const;

export type CostModel = (typeof costModelOptions)[number]['value'];
export type PaymentTiming = (typeof paymentTimingOptions)[number]['value'];
