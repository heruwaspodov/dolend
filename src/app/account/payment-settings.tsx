'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WorkspaceFormSection, workspaceFormAction, workspaceFormControl } from '@/components/organizer/workspace-form';
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
  return (
    <WorkspaceFormSection id="payment-settings-title" title="Pengaturan pembayaran" description="Dana masuk langsung ke organizer. Gunakan QRIS resmi milikmu.">
      <div className="space-y-5">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2" aria-labelledby="add-method-title">
          <h3 id="add-method-title" className="text-sm font-semibold sm:col-span-2">Tambah metode pembayaran</h3>
          <div className="grid gap-2">
            <Label htmlFor="payment-type">Metode</Label>
            <select id="payment-type" value={type} onChange={e => setType(e.target.value)} className={workspaceFormControl}>
              <option value="static_qris">QRIS statis</option>
              <option value="bank_transfer">Transfer bank</option>
              <option value="cash">Tunai</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-recipient">Nama penerima / merchant</Label>
            <Input id="payment-recipient" name="recipient" required maxLength={120} className={workspaceFormControl} />
          </div>
          {type === 'static_qris' && (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="payment-qris">Gambar QRIS</Label>
              <Input id="payment-qris" name="qris" type="file" accept="image/png,image/jpeg" required aria-describedby="payment-qris-hint" className={`${workspaceFormControl} py-2 file:me-3`} />
              <p id="payment-qris-hint" className="text-sm leading-5 text-[#615d59]">
                PNG atau JPG, maksimal 2 MB. Untuk mengganti QRIS, tambahkan gambar baru lalu nonaktifkan metode lama. Riwayat tetap disimpan. Gambar QRIS tidak menjadi konfirmasi pembayaran.
              </p>
            </div>
          )}
          {type === 'bank_transfer' && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="payment-bank">Bank</Label>
                <Input id="payment-bank" name="bank" required maxLength={120} className={workspaceFormControl} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="payment-account">Nomor rekening</Label>
                <Input id="payment-account" name="account" required maxLength={100} className={workspaceFormControl} />
              </div>
            </>
          )}
          <Button className={`${workspaceFormAction} w-full sm:col-span-2 sm:w-fit`} disabled={busy} type="submit">
            {busy ? 'Memproses…' : 'Simpan metode'}
          </Button>
        </form>

        <p role="status" className="text-sm empty:sr-only">{message}</p>
        <section className="space-y-4 border-t pt-6" aria-labelledby="saved-methods-title">
          <h3 id="saved-methods-title" className="text-base font-semibold">Metode tersimpan</h3>
          <div className="grid gap-2">
            <Label htmlFor="method-event">Gunakan metode pada event</Label>
            <select id="method-event" value={eventId} onChange={e => setEventId(e.target.value)} className={workspaceFormControl}>
              <option value="">Pilih event</option>
              {events.map(event => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </div>
          {loading ? <p className="text-sm text-[#615d59]">Memuat metode pembayaran…</p> : !methods.length ? (
            <p className="text-sm text-[#615d59]">Belum ada metode pembayaran.</p>
          ) : (
            <ul className="divide-y">
              {methods.map(method => (
                <li key={method.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                    <p className="break-words text-sm font-medium">{method.recipient_name}</p>
                    <p className="text-sm text-[#615d59]">
                      {method.type === 'static_qris' ? 'QRIS' : method.type === 'cash' ? 'Tunai' : 'Transfer'} · {method.is_active ? 'Aktif' : 'Nonaktif'}
                    </p>
                  </div>
                  <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => toggle(method)}>
                    {method.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </Button>
                  {eventId && method.is_active && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={busy} className="min-h-11" onClick={() => enable(method, true)}>Gunakan di event</Button>
                      <Button variant="outline" disabled={busy} className="min-h-11" onClick={() => enable(method, false)}>Matikan di event</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceFormSection>
  );
}
