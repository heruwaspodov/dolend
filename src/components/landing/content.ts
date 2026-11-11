import { costModelOptions, paymentTimingOptions, type CostModel, type PaymentTiming } from '@/lib/event-billing-options';
import { CircleDot, Gamepad2, Music, Trophy } from 'lucide-react';

export const categories = [
  { id: 'soccer', name: 'Mini Soccer', title: 'Futsal & Mini Soccer', tag: 'Mini Soccer & Futsal', icon: Trophy, image: '/images/landing/soccer.jpg', banner: '/images/landing/soccer-hero.jpg', description: 'Atur sparring bersama teman. Sepakati kuota pemain dan bagi biaya lapangan per orang.', cost: 'Contoh patungan: Rp50.000/orang' },
  { id: 'badminton', name: 'GOR Badminton', title: 'GOR Badminton', tag: 'Badminton & Tennis', icon: CircleDot, image: '/images/landing/badminton.jpg', banner: '/images/landing/badminton.jpg', description: 'Dari main ganda sampai latihan rutin. Rencanakan biaya lapangan dan perlengkapan bersama.', cost: 'Contoh patungan: Rp25.000/orang' },
  { id: 'music', name: 'Studio Musik', title: 'Studio Latihan Musik', tag: 'Musik & Jamming', icon: Music, image: '/images/landing/music.jpg', banner: '/images/landing/music.jpg', description: 'Sesi jamming makin gampang direncanakan saat waktu, tempat, dan patungannya jelas.', cost: 'Contoh patungan: Rp30.000/orang' },
  { id: 'games', name: 'Board Game', title: 'Board Game & BBQ', tag: 'Social & Games', icon: Gamepad2, image: '/images/landing/board-game.jpg', banner: '/images/landing/board-game.jpg', description: 'Main board game, BBQ, atau sekadar kumpul. Ada banyak alasan untuk ketemu lagi.', cost: 'Sesuaikan dengan rencana kalian' },
] as const;
export type CategoryId = typeof categories[number]['id'];
export type DemoConfig = { category: CategoryId; venue: string; schedule: string; cost: string; price: string; capacity: string; joined: string; costModel: CostModel; paymentTiming: PaymentTiming; paid: boolean[] };
export const defaultDemo: DemoConfig = { category: 'soccer', venue: 'Pitch 9 Mini Soccer Arena', schedule: 'Sabtu, 19.00–21.00 WIB', cost: '600000', price: '50000', capacity: '12', joined: '', costModel: 'dynamic', paymentTiming: 'before_event', paid: [true, true, false] };
export function validDemoAmount(value: unknown, minimum = 0): value is string {
  return typeof value === 'string' && /^\d{1,13}$/.test(value) && Number(value) >= minimum && Number(value) <= 1e12;
}
export function validConfig(input: unknown): input is DemoConfig {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return categories.some(category => category.id === value.category) &&
    typeof value.venue === 'string' && value.venue.length <= 120 && typeof value.schedule === 'string' && value.schedule.length <= 120 &&
    typeof value.cost === 'string' && typeof value.price === 'string' &&
    (value.costModel === 'free' || (value.costModel === 'dynamic' ? validDemoAmount(value.cost) : validDemoAmount(value.price, 1))) &&
    typeof value.capacity === 'string' && /^\d{1,2}$/.test(value.capacity) && Number(value.capacity) >= 2 && Number(value.capacity) <= 30 &&
    typeof value.joined === 'string' && (value.costModel !== 'dynamic' || value.joined === ''
      || (/^\d{1,2}$/.test(value.joined) && Number(value.joined) >= 1 && Number(value.joined) <= Number(value.capacity))) &&
    costModelOptions.some(option => option.value === value.costModel) &&
    paymentTimingOptions.some(option => option.value === value.paymentTiming) && Array.isArray(value.paid) && value.paid.length === 3 && value.paid.every(item => typeof item === 'boolean');
}
export function restoreDemo(input: unknown): DemoConfig | undefined {
  if (validConfig(input)) return input;
  if (!input || typeof input !== 'object') return;

  const legacy = input as Record<string, unknown>;
  const { billingMode, policy } = legacy;
  if (billingMode === 'dynamic' || billingMode === 'free' || billingMode === 'before_event' || billingMode === 'after_event') {
    const config = {
      ...legacy,
      joined: '',
      costModel: billingMode === 'dynamic' || billingMode === 'free' ? billingMode : 'fixed',
      paymentTiming: billingMode === 'after_event' ? 'after_event' : 'before_event',
    };
    return validConfig(config) ? config : undefined;
  }
  if (policy !== 'lunas' && policy !== 'dp' && policy !== 'nanti') return;
  const config = {
    ...legacy,
    price: defaultDemo.price,
    joined: '',
    costModel: 'dynamic',
    paymentTiming: 'before_event',
  };
  if (!validConfig(config)) return;

  const total = Number(config.cost);
  return {
    ...config,
    costModel: total === 0 ? 'free' : 'fixed',
    paymentTiming: policy === 'nanti' ? 'after_event' : 'before_event',
    price: String(Math.ceil(total / Number(config.capacity))),
    paid: policy === 'dp' ? [false, false, false] : config.paid,
  };
}
export function demoLink(config: DemoConfig) {
  return `https://dolend.web.app/#simulasi?demo=${encodeURIComponent(JSON.stringify(config))}`;
}
export const rupiah = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`;
