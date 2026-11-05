'use client';

import Image from 'next/image';
import { useEffect, useState, type ChangeEvent } from 'react';
import { ImagePlus, LoaderCircle, MessageCircleWarning, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { deleteActivityPhoto, getActivityPhotos, getPhotoModerationQueue, reportActivityPhoto, reviewActivityPhoto, uploadActivityPhoto, type ActivityPhoto } from '@/lib/activity-client';

export function ActivityPhotoPanel({token,activityId,isOwn}:{token:string;activityId:string;isOwn:boolean}) {
  const [photos,setPhotos]=useState<ActivityPhoto[]>([]),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  useEffect(()=>{let active=true;getActivityPhotos(token,activityId).then(items=>{if(active)setPhotos(items);}).catch(cause=>{if(active)setError(cause instanceof Error?cause.message:'Foto belum dapat dimuat.');});return()=>{active=false;};},[token,activityId]);
  async function upload(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; event.target.value=''; if(!file)return;
    if(!consent) {setError('Konfirmasi izin membagikan foto terlebih dahulu.');return;}
    setBusy(true);setError('');setMessage('');
    try { const photo=await uploadActivityPhoto(token,activityId,file);setPhotos(current=>[...current,photo]);setMessage('Foto ditambahkan.'); }
    catch(cause) {setError(cause instanceof Error?cause.message:'Foto belum dapat diunggah.');}
    finally {setBusy(false);}
  }
  async function remove(photo:ActivityPhoto) {
    setBusy(true);setError('');
    try {await deleteActivityPhoto(token,activityId,photo.id);setPhotos(current=>current.filter(item=>item.id!==photo.id));setMessage('Foto dihapus.');}
    catch(cause) {setError(cause instanceof Error?cause.message:'Foto belum dapat dihapus.');}
    finally {setBusy(false);}
  }
  async function report(photo:ActivityPhoto) {
    setBusy(true);setError('');
    try {await reportActivityPhoto(token,activityId,photo.id);setPhotos(current=>current.filter(item=>item.id!==photo.id));setMessage('Laporan foto diterima.');}
    catch(cause) {setError(cause instanceof Error?cause.message:'Laporan foto belum dapat dikirim.');}
    finally {setBusy(false);}
  }
  return <section className="mt-4 space-y-3" aria-label="Foto aktivitas">
    {photos.length>0&&<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{photos.map(photo=><li key={photo.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <Image src={photo.url} width={photo.width} height={photo.height} unoptimized alt="Foto aktivitas" className="aspect-square h-auto max-h-72 w-full object-cover" />
      {isOwn?<Button type="button" variant="ghost" className="absolute right-1 top-1 min-h-10 bg-white/95 px-2 text-rose-700" aria-label="Hapus foto" disabled={busy} onClick={()=>void remove(photo)}><Trash2 aria-hidden="true" /></Button>:<Button type="button" variant="ghost" className="absolute right-1 top-1 min-h-10 bg-white/95 px-2 text-slate-700" aria-label="Laporkan foto" disabled={busy} onClick={()=>void report(photo)}><MessageCircleWarning aria-hidden="true" /></Button>}
    </li>)}</ul>}
    {isOwn&&photos.length<5&&<div className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} className="size-5 accent-emerald-700" />Saya memiliki izin untuk membagikan foto ini.</label>
      <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold ${consent&&!busy?'bg-emerald-700 text-white':'bg-slate-100 text-slate-500'}`}>
        {busy?<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true"/>:<ImagePlus className="size-4" aria-hidden="true"/>}Tambah foto
        <input aria-label="Pilih foto aktivitas" type="file" accept="image/png,image/jpeg" disabled={!consent||busy} onChange={event=>void upload(event)} className="sr-only" />
      </label>
      <p className="text-xs text-slate-600">PNG/JPEG, maksimal 2 MiB. Metadata lokasi dihapus saat diproses.</p>
    </div>}
    {(error||message)&&<p role={error?'alert':'status'} className={`text-sm ${error?'text-rose-700':'text-emerald-700'}`}>{error||message}</p>}
  </section>;
}

type QueuePhoto=ActivityPhoto&{photo_id:string;reports:Array<{reason:string;details:string}>};
export function ActivityPhotoModeration({token}:{token:string}) {
  const [open,setOpen]=useState(false),[items,setItems]=useState<QueuePhoto[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
  async function load() {setOpen(true);setError('');try{setItems(await getPhotoModerationQueue(token));}catch(cause){setError(cause instanceof Error?cause.message:'Antrian foto belum dapat dimuat.');}}
  async function review(photo:QueuePhoto,action:'dismiss'|'hide'|'remove') {setBusy(photo.photo_id);setError('');try{await reviewActivityPhoto(token,photo.photo_id,action);setItems(current=>current.filter(item=>item.photo_id!==photo.photo_id));}catch(cause){setError(cause instanceof Error?cause.message:'Tinjauan belum dapat disimpan.');}finally{setBusy('');}}
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <Button type="button" variant="outline" className="min-h-11" onClick={()=>open?setOpen(false):void load()}>{open?'Tutup antrian moderasi':'Antrian moderasi foto'}</Button>
    {open&&<div className="mt-4 space-y-3" aria-label="Antrian moderasi foto">
      {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
      {!error&&items.length===0&&<p className="text-sm text-slate-600">Tidak ada laporan foto yang menunggu.</p>}
      {items.map(photo=><article key={photo.photo_id} className="rounded-xl border border-slate-200 p-3">
        <Image src={photo.url} width={photo.width||640} height={photo.height||480} unoptimized alt="Foto dalam tinjauan" className="max-h-64 w-full rounded-lg object-contain" />
        <ul className="mt-2 list-inside list-disc text-sm">{(photo.reports??[]).map((report,index)=><li key={`${photo.photo_id}-${index}`}>{report.reason}{report.details?`: ${report.details}`:''}</li>)}</ul>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" className="min-h-11" disabled={busy===photo.photo_id} onClick={()=>void review(photo,'dismiss')}>Pulihkan</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy===photo.photo_id} onClick={()=>void review(photo,'hide')}>Sembunyikan</Button><Button type="button" variant="outline" className="min-h-11 text-rose-700" disabled={busy===photo.photo_id} onClick={()=>void review(photo,'remove')}>Hapus</Button></div>
      </article>)}
    </div>}
  </section>;
}
