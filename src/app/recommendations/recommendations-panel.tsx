'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { getRecommendationActivityTypes, getRecommendations, recordRecommendationFeedback, saveRecommendationPreferences, type ActivityTypeOption, type EventRecommendation, type RecommendationPreferences } from '@/lib/recommendations-client';

const emptyPreferences: RecommendationPreferences = { opted_out: false, personalization_enabled: false, activity_type_ids: [], weekdays: [], coarse_region_code: null };
const weekdayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const formatStart = (date: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

export function RecommendationsPanel() {
  const router = useRouter();
  const { session, ready } = useOrganizerSession();
  const [items, setItems] = useState<EventRecommendation[]>([]);
  const [preferences, setPreferences] = useState<RecommendationPreferences>(emptyPreferences);
  const [categories, setCategories] = useState<ActivityTypeOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    if (!session) return;
    setBusy(true); setError('');
    try {
      const [page, types] = await Promise.all([getRecommendations(session.access_token), getRecommendationActivityTypes(session.access_token)]);
      setItems(page.items); setPreferences(page.preferences); setCategories(types);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Rekomendasi belum dapat dimuat.'); }
    finally { setBusy(false); }
  }, [session]);
  useEffect(() => { if (session) void Promise.resolve().then(load); }, [session, load]);
  function toggleCategory(id: string) { setPreferences((current) => ({ ...current, activity_type_ids: current.activity_type_ids.includes(id) ? current.activity_type_ids.filter((value) => value !== id) : [...current.activity_type_ids, id] })); }
  function toggleWeekday(day: number) { setPreferences((current) => ({ ...current, weekdays: current.weekdays.includes(day) ? current.weekdays.filter((value) => value !== day) : [...current.weekdays, day].sort((a, b) => a - b) })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setError(''); setMessage('');
    const input = preferences.opted_out
      ? { ...emptyPreferences, opted_out: true }
      : preferences.personalization_enabled
        ? { ...preferences, coarse_region_code: preferences.coarse_region_code?.trim().toUpperCase() || null }
        : { ...emptyPreferences };
    try {
      await saveRecommendationPreferences(session.access_token, input);
      setMessage(input.opted_out ? 'Rekomendasi dimatikan.' : input.personalization_enabled ? 'Pilihan rekomendasi disimpan.' : 'Personalisasi dimatikan; rekomendasi umum tetap tersedia.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Preferensi belum dapat disimpan.'); }
    finally { setBusy(false); }
  }
  async function openRecommendation(item: EventRecommendation) {
    if (!session) return;
    setFeedbackBusy(item.event_id); setError('');
    try { await recordRecommendationFeedback(session.access_token, item.event_id, 'open', item.ranking_version, crypto.randomUUID()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Masukan belum dapat disimpan.'); }
    finally { setFeedbackBusy(''); router.push(`/event/?id=${encodeURIComponent(item.event_id)}`); }
  }
  async function dismissRecommendation(item: EventRecommendation) {
    if (!session) return;
    setFeedbackBusy(item.event_id); setError(''); setMessage('');
    try {
      await recordRecommendationFeedback(session.access_token, item.event_id, 'dismiss', item.ranking_version, crypto.randomUUID());
      setItems((current) => current.filter((entry) => entry.event_id !== item.event_id));
      setMessage('Rekomendasi disembunyikan.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Masukan belum dapat disimpan.'); }
    finally { setFeedbackBusy(''); }
  }

  if (!ready) return <p role="status" className="mt-6 rounded-xl border bg-white p-5 text-sm text-slate-600">Memeriksa sesi…</p>;
  if (!session) return <section className="mt-6 rounded-2xl border bg-white p-6"><h1 className="text-2xl font-extrabold">Rekomendasi acara</h1><p className="mt-3 text-sm text-slate-600">Masuk untuk melihat dan mengatur rekomendasi acara publik.</p><Button asChild className="mt-5 min-h-11 bg-emerald-700 text-white"><Link href="/account/">Masuk dengan Google</Link></Button></section>;

  return <section className="mx-auto mt-6 max-w-3xl space-y-5">
    <header><p className="text-xs font-bold tracking-widest text-emerald-700 uppercase">Jelajahi Dolend</p><h1 className="mt-2 text-3xl font-extrabold">Rekomendasi acara</h1><p className="mt-2 text-sm text-slate-600">Acara publik yang akan datang, masih menerima peserta, dan belum penuh.</p></header>
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">Atur rekomendasimu</h2>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={preferences.personalization_enabled} disabled={preferences.opted_out || busy} onChange={(event) => setPreferences((current) => ({ ...current, personalization_enabled: event.target.checked }))} />Gunakan minat yang kupilih untuk personalisasi</label>
      {preferences.personalization_enabled && !preferences.opted_out && <>
        <fieldset><legend className="text-sm font-semibold">Kategori aktivitas</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{categories.map((category) => <label key={category.id} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={preferences.activity_type_ids.includes(category.id)} disabled={busy} onChange={() => toggleCategory(category.id)} />{category.name}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold">Hari yang kamu pilih</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{weekdayNames.map((name, day) => <label key={name} className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={preferences.weekdays.includes(day)} disabled={busy} onChange={() => toggleWeekday(day)} />{name}</label>)}</div></fieldset>
        <label className="block text-sm font-semibold" htmlFor="coarse-region">Kode area umum (opsional)<input id="coarse-region" value={preferences.coarse_region_code ?? ''} disabled={busy} maxLength={32} onChange={(event) => setPreferences((current) => ({ ...current, coarse_region_code: event.target.value || null }))} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal" placeholder="Contoh: ID-JK" /><span className="mt-1 block text-xs font-normal text-slate-500">Masukkan kode kota/provinsi pilihan. Kami tidak meminta koordinat atau lokasi berjalan.</span></label>
      </>}
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={preferences.opted_out} disabled={busy} onChange={(event) => setPreferences((current) => ({ ...current, opted_out: event.target.checked, personalization_enabled: event.target.checked ? false : current.personalization_enabled }))} />Jangan tampilkan rekomendasi acara</label>
      <Button type="submit" disabled={busy} className="min-h-11 bg-emerald-700 text-white">{busy ? 'Menyimpan…' : 'Simpan pilihan'}</Button>
      <p className="text-xs leading-relaxed text-slate-500">Tanpa personalisasi, daftar memakai urutan waktu umum. Lokasi hanya memakai kode area yang kamu masukkan dan kode area umum pada event. Preferensi tidak mengaktifkan pengumpulan lokasi latar belakang.</p>
    </form>
    {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${error ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>{error || message}</p>}
    {busy && <p role="status" aria-busy="true" className="rounded-xl border bg-white p-5 text-sm text-slate-600">Memuat acara…</p>}
    {!busy && !error && preferences.opted_out && <p className="rounded-xl border bg-white p-5 text-sm text-slate-600">Rekomendasi dimatikan. Kamu bisa menyalakannya kembali kapan saja.</p>}
    {!busy && !error && !preferences.opted_out && items.length === 0 && <p className="rounded-xl border border-dashed bg-white p-6 text-sm text-slate-600">Belum ada acara publik yang cocok dan masih tersedia.</p>}
    {!busy && !preferences.opted_out && <div className="space-y-3" aria-live="polite">{items.map((item) => <article key={item.event_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-emerald-800">{item.activity_type_name}</p><h2 className="mt-1 text-lg font-bold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{formatStart(item.starts_at)} · {item.capacity_remaining} kursi tersedia</p><ul className="mt-3 flex flex-wrap gap-2">{item.reason_labels.map((reason) => <li key={reason} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{reason}</li>)}</ul><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={feedbackBusy === item.event_id} onClick={() => void openRecommendation(item)} className="min-h-11 bg-emerald-700 text-white">{feedbackBusy === item.event_id ? 'Membuka…' : 'Buka event'}</Button><Button type="button" variant="outline" disabled={feedbackBusy === item.event_id} onClick={() => void dismissRecommendation(item)} className="min-h-11">Tidak tertarik</Button></div></article>)}</div>}
  </section>;
}
