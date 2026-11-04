'use client';

import Link from 'next/link';
import { useEffect,useState,type FormEvent } from 'react';
import { CheckCircle2,LoaderCircle,LogIn,UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cancelMemberParticipation,getMemberParticipation,joinEventAsMember,type OwnParticipation } from '@/lib/participation-client';
import { useOrganizerSession } from '@/lib/use-organizer-session';
import { GuestBookingForm } from './guest-booking-form';

const activeStatuses=new Set(['held','confirmed','attended','no_show']);
const statusText:Record<string,string>={
  held:'Tempatmu sedang ditahan.',confirmed:'Kamu sudah terdaftar sebagai peserta.',attended:'Kehadiranmu sudah dicatat.',no_show:'Status kehadiranmu: tidak hadir.',
};

export function EventParticipation({eventId,inviteToken,bookingToken,seats}:{eventId:string;inviteToken?:string;bookingToken?:string;seats:number}) {
  const {session,ready}=useOrganizerSession();
  const [participation,setParticipation]=useState<OwnParticipation|null|undefined>(undefined);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!ready||!session||bookingToken)return;
    const controller=new AbortController();
    void getMemberParticipation(eventId,session.access_token,controller.signal).then(setParticipation).catch(reason=>{
      if(reason.name!=='AbortError')setError(reason instanceof Error?reason.message:'Status partisipasi belum dapat dimuat.');
    });
    return ()=>controller.abort();
  },[bookingToken,eventId,ready,session]);

  if(bookingToken)return <GuestBookingForm eventId={eventId} inviteToken={inviteToken} bookingToken={bookingToken}/>;
  if(!ready||(session&&participation===undefined))return <Card aria-busy="true"><CardContent className="pt-6"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true"/>Memeriksa partisipasi…</p></CardContent></Card>;
  if(!session)return <div className="space-y-4">{seats>0?<GuestBookingForm eventId={eventId} inviteToken={inviteToken}/>:<p className="text-sm text-muted-foreground">Kapasitas aktivitas sudah penuh.</p>}<p className="text-sm text-muted-foreground"><Link href="/account/" className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4">Masuk dengan Google</Link> jika ingin ikut sebagai member.</p></div>;

  async function join() {
    if(!session)return;setBusy('join');setError('');
    try{setParticipation(await joinEventAsMember(eventId,session.access_token,inviteToken));}
    catch(reason){const code=reason instanceof Error&&'code' in reason?reason.code:'';setError(code==='EVENT_FULL'?'Event baru saja penuh.':code==='REGISTRATION_CLOSED'?'Pendaftaran event sudah ditutup.':reason instanceof Error?reason.message:'Belum dapat ikut event.');}
    finally{setBusy('');}
  }

  async function cancel(formEvent:FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();if(!session)return;setBusy('cancel');setError('');
    const reason=String(new FormData(formEvent.currentTarget).get('reason')??'').trim();
    try{setParticipation(await cancelMemberParticipation(eventId,session.access_token,reason));}
    catch(requestError){setError(requestError instanceof Error?requestError.message:'Partisipasi belum dapat dibatalkan.');}
    finally{setBusy('');}
  }

  if(participation&&activeStatuses.has(participation.status))return <Card><CardHeader><CardTitle role="heading" aria-level={2} className="flex items-center gap-2"><UserCheck className="size-5 text-emerald-700" aria-hidden="true"/>Partisipasi kamu</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed">{statusText[participation.status]??'Partisipasi aktif.'}</p>{participation.invoice_id&&<Button asChild className="mt-4 min-h-11"><a href={`/payment/?invoice=${participation.invoice_id}`}>Lihat invoice</a></Button>}{!['attended','no_show'].includes(participation.status)&&<details className="mt-5 border-t pt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Batalkan partisipasi</summary><form className="pt-3" onSubmit={cancel}><Label htmlFor="member-cancel-reason">Alasan</Label><Input id="member-cancel-reason" name="reason" required maxLength={1000} className="mt-2 min-h-11"/><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Jika iuran sudah dikunci, pembatalan tidak otomatis menghapus tagihan. Hubungi organizer untuk penyesuaian.</p><Button type="submit" variant="destructive" disabled={busy==='cancel'} className="mt-3 min-h-11">{busy==='cancel'?'Membatalkan…':'Batalkan partisipasi'}</Button></form></details>}{error&&<p className="mt-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}</CardContent></Card>;

  return <Card><CardHeader><CardTitle role="heading" aria-level={2} className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-700" aria-hidden="true"/>Ikut sebagai member</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">Kamu sudah masuk dengan Google. Partisipasi akan terhubung ke akun yang sama, termasuk jika akun ini juga mengelola event.</p><Button type="button" disabled={busy==='join'||seats<=0} className="mt-5 min-h-11 bg-emerald-700 text-white hover:bg-emerald-800" onClick={()=>void join()}><LogIn aria-hidden="true"/>{busy==='join'?'Mendaftarkan…':seats<=0?'Event penuh':'Ikut event'}</Button>{error&&<p className="mt-3 text-sm font-medium text-rose-700" role="alert">{error}</p>}</CardContent></Card>;
}
