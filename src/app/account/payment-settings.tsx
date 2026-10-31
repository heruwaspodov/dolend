'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paymentRequest } from '@/lib/payment-client';

type Method = { id:string; type:string; recipient_name:string; is_active:boolean };
export function PaymentSettings({token}:{token:string}) {
  const [methods,setMethods]=useState<Method[]>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [events,setEvents]=useState<{id:string;title:string}[]>([]);
  const [eventId,setEventId]=useState('');
  const [type,setType]=useState('static_qris');
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    void paymentRequest<{id:string;title:string}[]>('/organizer/events',token,{signal:controller.signal}).then(setEvents).catch(e=>{if(e.name!=='AbortError')setMessage(e.message);});
    paymentRequest<Method[]>('/payment-settings',token,{signal:controller.signal}).then(setMethods).catch(e=>{if(e.name!=='AbortError')setMessage(e.message);}).finally(()=>setLoading(false));
    return ()=>controller.abort();
  },[token]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form=event.currentTarget; const values=new FormData(form);
    try {
      let storage_path:string|undefined;
      if(type==='static_qris') {
        const file=values.get('qris');
        if(!(file instanceof File)||!file.size||file.size>2097152||!['image/png','image/jpeg'].includes(file.type)) throw new Error('Pilih QRIS PNG/JPG maksimal 2 MB.');
        const uploaded=await paymentRequest<{storage_path:string}>('/payment-settings/qris-image',token,{method:'POST',body:file});
        storage_path=uploaded.storage_path;
      }
      const method=await paymentRequest<Method>('/payment-settings',token,{method:'POST',body:JSON.stringify({type,recipient_name:String(values.get('recipient')),storage_path,...(type==='bank_transfer'?{bank_details:{bank:String(values.get('bank')),account:String(values.get('account'))}}:{})})});
      setMethods(current=>[...current,method]);setMessage('Metode pembayaran tersimpan. Aktifkan pada event yang sesuai.');form.reset();
    }catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan.');}finally{setBusy(false);}
  }
  async function toggle(method:Method){
    setBusy(true);
    try{const result=await paymentRequest<Method>(`/payment-settings/${method.id}`,token,{method:'PATCH',body:JSON.stringify({is_active:!method.is_active})});setMethods(current=>current.map(m=>m.id===result.id?result:m));}
    catch(e){setMessage(e instanceof Error?e.message:'Gagal mengubah metode.');}finally{setBusy(false);}
  }
  async function enable(method:Method,enabled:boolean){
    if(!eventId)return;setBusy(true);
    try{await paymentRequest(`/events/${eventId}/payment-methods`,token,{method:'POST',body:JSON.stringify({method_id:method.id,enabled})});setMessage(enabled?'Metode diaktifkan untuk event terpilih.':'Metode dimatikan untuk event terpilih.');}
    catch(e){setMessage(e instanceof Error?e.message:'Gagal mengubah metode event.');}finally{setBusy(false);}
  }
  return <section className="space-y-5 rounded-xl border bg-card p-5 sm:p-8" aria-labelledby="payment-settings-title">
    <h2 id="payment-settings-title" className="text-xl font-bold">Pengaturan pembayaran</h2>
    <p className="text-sm text-muted-foreground">Dana langsung masuk ke organizer. Gunakan QRIS resmi milikmu. Gambar QRIS tidak menjadi konfirmasi pembayaran.</p>
    <form onSubmit={save} className="grid gap-4">
      <div className="space-y-2"><Label htmlFor="payment-type">Metode</Label><select id="payment-type" value={type} onChange={e=>setType(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3"><option value="static_qris">QRIS statis</option><option value="bank_transfer">Transfer bank</option><option value="cash">Tunai</option></select></div>
      <div className="space-y-2"><Label htmlFor="payment-recipient">Nama penerima / merchant</Label><Input id="payment-recipient" name="recipient" required maxLength={120}/></div>
      {type==='static_qris'&&<div className="space-y-2"><Label htmlFor="payment-qris">Gambar QRIS (PNG/JPG, maksimal 2 MB)</Label><Input id="payment-qris" name="qris" type="file" accept="image/png,image/jpeg" required className="min-h-11"/><p className="text-sm text-muted-foreground">Untuk mengganti QRIS, tambahkan gambar baru lalu nonaktifkan metode lama. Riwayat tetap disimpan.</p></div>}
      {type==='bank_transfer'&&<><div className="space-y-2"><Label htmlFor="payment-bank">Bank</Label><Input id="payment-bank" name="bank" required maxLength={120}/></div><div className="space-y-2"><Label htmlFor="payment-account">Nomor rekening</Label><Input id="payment-account" name="account" required maxLength={100}/></div></>}
      <Button className="min-h-11" disabled={busy} type="submit">{busy?'Memproses…':'Simpan metode'}</Button>
    </form>
    <p role="status" aria-live="polite">{message}</p>
    <div className="space-y-2"><Label htmlFor="method-event">Gunakan metode pada event</Label><select id="method-event" value={eventId} onChange={e=>setEventId(e.target.value)} className="min-h-11 w-full rounded-md border bg-background px-3"><option value="">Pilih event</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
    {loading?<p>Memuat metode pembayaran…</p>:!methods.length?<p>Belum ada metode pembayaran.</p>:<ul className="divide-y">{methods.map(m=><li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{m.recipient_name} · {m.type==='static_qris'?'QRIS':m.type==='cash'?'Tunai':'Transfer'} · {m.is_active?'Aktif':'Nonaktif'}</span><Button variant="outline" className="min-h-11" disabled={busy} onClick={()=>toggle(m)}>{m.is_active?'Nonaktifkan':'Aktifkan'}</Button>{eventId&&m.is_active&&<div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} className="min-h-11" onClick={()=>enable(m,true)}>Gunakan di event</Button><Button variant="outline" disabled={busy} className="min-h-11" onClick={()=>enable(m,false)}>Matikan di event</Button></div>}</li>)}</ul>}
  </section>;
}
