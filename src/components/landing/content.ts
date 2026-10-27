import { CircleDot, Gamepad2, Music, Trophy } from 'lucide-react';

export const categories = [
  { id: 'soccer', name: 'Mini Soccer', title: 'Futsal & Mini Soccer', tag: 'Mini Soccer & Futsal', icon: Trophy, image: '/images/landing/soccer.jpg', banner: '/images/landing/soccer-hero.jpg', description: 'Atur sparring bersama teman. Sepakati kuota pemain dan bagi biaya lapangan per orang.', cost: 'Contoh patungan: Rp50.000/orang' },
  { id: 'badminton', name: 'GOR Badminton', title: 'GOR Badminton', tag: 'Badminton & Tennis', icon: CircleDot, image: '/images/landing/badminton.jpg', banner: '/images/landing/badminton.jpg', description: 'Dari main ganda sampai latihan rutin. Rencanakan biaya lapangan dan perlengkapan bersama.', cost: 'Contoh patungan: Rp25.000/orang' },
  { id: 'music', name: 'Studio Musik', title: 'Studio Latihan Musik', tag: 'Musik & Jamming', icon: Music, image: '/images/landing/music.jpg', banner: '/images/landing/music.jpg', description: 'Sesi jamming makin gampang direncanakan saat waktu, tempat, dan patungannya jelas.', cost: 'Contoh patungan: Rp30.000/orang' },
  { id: 'games', name: 'Board Game', title: 'Board Game & BBQ', tag: 'Social & Games', icon: Gamepad2, image: '/images/landing/board-game.jpg', banner: '/images/landing/board-game.jpg', description: 'Main board game, BBQ, atau sekadar kumpul. Ada banyak alasan untuk ketemu lagi.', cost: 'Sesuaikan dengan rencana kalian' },
] as const;
export type CategoryId = typeof categories[number]['id'];
export type Policy = 'lunas' | 'dp' | 'nanti';
export type DemoConfig = { category: CategoryId; venue: string; schedule: string; cost: string; capacity: string; policy: Policy; paid: boolean[] };
export const defaultDemo: DemoConfig = { category: 'soccer', venue: 'Pitch 9 Mini Soccer Arena', schedule: 'Sabtu, 19.00–21.00 WIB', cost: '600000', capacity: '12', policy: 'lunas', paid: [true, true, false] };
export function validConfig(input: unknown): input is DemoConfig {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return categories.some(category => category.id === value.category) &&
    typeof value.venue === 'string' && value.venue.length <= 120 && typeof value.schedule === 'string' && value.schedule.length <= 120 &&
    typeof value.cost === 'string' && value.cost.trim() !== '' && /^\d{1,13}$/.test(value.cost) && Number(value.cost) <= 1e12 &&
    typeof value.capacity === 'string' && /^\d{1,2}$/.test(value.capacity) && Number(value.capacity) >= 2 && Number(value.capacity) <= 30 &&
    ['lunas', 'dp', 'nanti'].includes(String(value.policy)) && Array.isArray(value.paid) && value.paid.length === 3 && value.paid.every(item => typeof item === 'boolean');
}
export function demoLink(config: DemoConfig) {
  return `https://dolend.web.app/#simulasi?demo=${encodeURIComponent(JSON.stringify(config))}`;
}
export const rupiah = (amount: number) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(amount)}`;
