'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ReturnMessage } from '@/components/layout/return-message';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { paymentRequest } from '@/lib/payment-client';

type Charge={id:string;amount:number;balance:number;records:{id:string;amount:number;status:string}[];methods:{id:string;type:string;recipient_name:string;bank_details?:{bank:string;account:string};qris_url:string|null}[]};
type InvoiceMethod={id:string;method_type:string;instruction_snapshot:Record<string,unknown>};
type Invoice={id:string;invoice_number:string;amount_due:number;currency:'IDR';due_at:string;status:'open'|'paid'|'void'|'waived';overdue:boolean;participant_status:string;methods:InvoiceMethod[];attempts:{id:string;status:string;created_at:string}[]};
const money=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export function PaymentPanel(){
 const [noCharge,setNoCharge]=useState(false);
 const [charge,setCharge]=useState<Charge>();const [invoice,setInvoice]=useState<Invoice>();const [message,setMessage]=useState('Memuat tagihan…');const [busy,setBusy]=useState(false);
 const proofCache=useRef<{key:string;path:string}|null>(null);
 const [auth,setAuth]=useState({token:'',booking:''});const [attempt,setAttempt]=useState('');
 useEffect(()=>{let active=true;
  void (async()=>{
   try{const search=new URLSearchParams(window.location.search);const chargeId=search.get('charge');const invoiceId=search.get('invoice');const id=chargeId??invoiceId;if(!id){if(active)setNoCharge(true);return;}if(! /^[0-9a-f-]{36}$/i.test(id))throw new Error('Buka pembayaran dari tautan booking kamu.');
    const booking=new URLSearchParams(window.location.hash.slice(1)).get('booking')??'';
    const {data}=await getSupabaseBrowserClient().auth.getSession();const token=data.session?.access_token??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??'';
    const headers:Record<string,string>=booking?{'x-booking-token':booking}:{};
    if(invoiceId){const result=await paymentRequest<Invoice>(`/invoices/${id}`,token,{headers});if(active)setInvoice(result);}
    else {const result=await paymentRequest<Charge>(`/charges/${id}`,token,{headers});if(active)setCharge(result);}
    if(active){setAuth({token,booking});setAttempt(crypto.randomUUID());setMessage('');}
   }catch(e){if(active)setMessage(e instanceof Error?e.message:'Tagihan gagal dimuat.');}
  })();return()=>{active=false;};
 },[]);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!charge)return;setBusy(true);const values=new FormData(e.currentTarget);
  const headers: Record<string,string>=auth.booking?{'x-booking-token':auth.booking}:{};
  try{let proof_storage_path:string|undefined;const file=values.get('proof');if(file instanceof File&&file.size){if(file.size>2097152)throw new Error('Bukti maksimal 2 MB.');const fileKey=`${file.name}:${file.size}:${file.lastModified}`;if(proofCache.current?.key===fileKey){proof_storage_path=proofCache.current.path;}else{const uploaded=await paymentRequest<{storage_path:string}>(`/charges/${charge.id}/proof`,auth.token,{method:'POST',body:file,headers});proof_storage_path=uploaded.storage_path;proofCache.current={key:fileKey,path:proof_storage_path};}}
   await paymentRequest(`/charges/${charge.id}/payments`,auth.token,{method:'POST',headers,body:JSON.stringify({method_id:values.get('method'),amount:Number(values.get('amount')),idempotency_key:attempt,proof_storage_path})});
   const result=await paymentRequest<Charge>(`/charges/${charge.id}`,auth.token,{headers});setCharge(result);setAttempt(crypto.randomUUID());proofCache.current=null;setMessage('Laporan diterima. Menunggu verifikasi organizer.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal melaporkan pembayaran.');}finally{setBusy(false);}
 }
 if(noCharge)return <ReturnMessage kind="payment"/>;
 return <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-5 sm:p-8"><h1 className="text-2xl font-bold">Pembayaran iuran</h1><p role="status" aria-live="polite">{message}</p>{invoice&&<InvoiceSummary invoice={invoice}/>} {charge&&<><p>Tagihan terkunci: {money(charge.amount)}</p><p>{charge.balance<0?'Kelebihan bayar':'Sisa tagihan'}: {money(Math.abs(charge.balance))}</p><ul className="space-y-4">{charge.methods.map(m=><li key={m.id} className="space-y-2 border-t pt-3"><p>{m.recipient_name} · {m.type==='static_qris'?'QRIS statis':m.type==='cash'?'Tunai':'Transfer bank'}</p>{m.bank_details&&<p>{m.bank_details.bank} · {m.bank_details.account}</p>}{m.qris_url&&<Button asChild variant="outline" className="min-h-11"><a href={m.qris_url} target="_blank" rel="noreferrer">Buka / simpan gambar QRIS</a></Button>}</li>)}</ul><p className="text-sm text-muted-foreground">Masukkan nominal sesuai tagihan di aplikasi bank. Dana langsung ke organizer. Untuk tunai, organizer mencatat penerimaan.</p><form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="pay-method">Metode yang digunakan</Label><select id="pay-method" name="method" required className="min-h-11 w-full rounded-md border bg-background px-3">{charge.methods.filter(m=>m.type!=='cash').map(m=><option key={m.id} value={m.id}>{m.recipient_name} · {m.type==='static_qris'?'QRIS':'Transfer'}</option>)}</select></div><div className="space-y-2"><Label htmlFor="pay-amount">Nominal yang dibayar (Rp)</Label><Input id="pay-amount" name="amount" type="number" min={1} max={1e12} step={1} required defaultValue={Math.max(charge.balance,1)}/></div><div className="space-y-2"><Label htmlFor="pay-proof">Bukti opsional (PNG/JPG, maksimal 2 MiB)</Label><Input id="pay-proof" name="proof" type="file" accept="image/png,image/jpeg"/></div><Button type="submit" disabled={busy||!charge.methods.some(m=>m.type!=='cash')} className="min-h-11">{busy?'Mengirim…':'Saya sudah bayar'}</Button></form><ul className="divide-y">{charge.records.map(r=><li className="py-3" key={r.id}>{money(r.amount)} · {r.status==='verified'?'Terverifikasi':r.status==='rejected'?'Ditolak':'Menunggu verifikasi'}</li>)}</ul></>}</section>;
}

function InvoiceSummary({invoice}:{invoice:Invoice}) {
 const status=invoice.status==='paid'?'Lunas':invoice.status==='waived'?'Dibebaskan':invoice.status==='void'?'Dibatalkan':invoice.overdue?'Lewat jatuh tempo':'Belum dibayar';
 return <div className="space-y-4"><div className="rounded-lg bg-muted p-4"><p className="text-sm text-muted-foreground">{invoice.invoice_number}</p><p className="mt-1 text-2xl font-bold">{money(invoice.amount_due)}</p><p className="mt-2 text-sm">{status} · jatuh tempo {new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(invoice.due_at))}</p></div>{invoice.methods.length>0?<ul className="space-y-3">{invoice.methods.map(method=>{const details=method.instruction_snapshot;const bankDetails=details.bank_details&&typeof details.bank_details==='object'?details.bank_details as Record<string,unknown>:details;return <li key={method.id} className="rounded-lg border p-4"><p className="font-medium">{method.method_type==='manual_bank_transfer'?'Transfer manual':method.method_type==='qris'?'QRIS':'Pembayaran online'}</p>{typeof bankDetails.bank==='string'&&<p className="mt-2 text-sm">{bankDetails.bank}{typeof bankDetails.account==='string'?` · ${bankDetails.account}`:''}</p>}</li>;})}</ul>:invoice.status==='open'&&<p className="text-sm text-muted-foreground">Instruksi pembayaran belum tersedia. Hubungi organizer.</p>}{invoice.attempts.length>0&&<ul className="divide-y">{invoice.attempts.map(attempt=><li key={attempt.id} className="py-3 text-sm">Percobaan pembayaran · {attempt.status}</li>)}</ul>}</div>;
}
