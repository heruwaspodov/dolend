import {test,expect} from '@playwright/test';

test('manual payment reports partial amount without claiming verified',async({page})=>{
 const id='11111111-1111-4111-8111-111111111111';
 const method='22222222-2222-4222-8222-222222222222';
 let reported=false;
 await page.route(`**/dolend-api/v1/charges/${id}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id,amount:5001,balance:5001,records:reported?[{id:'report',amount:2000,status:'pending_verification'}]:[],methods:[{id:method,type:'bank_transfer',recipient_name:'Organizer',bank_details:{bank:'Bank fixture',account:'12345'},qris_url:null}]}})}));
 await page.route(`**/dolend-api/v1/charges/${id}/payments`,async route=>{
  expect(route.request().headers()['x-booking-token']).toBe('a'.repeat(43));
  expect(route.request().postDataJSON().amount).toBe(2000);
  reported=true;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{status:'pending_verification'}})});
 });
 await page.goto(`/payment/?charge=${id}#booking=${'a'.repeat(43)}`);
 await expect(page.getByText('Bank fixture · 12345')).toBeVisible();
 await page.getByLabel('Nominal yang dibayar (Rp)').fill('2000');
 await page.getByRole('button',{name:'Saya sudah bayar'}).click();
 await expect(page.getByRole('status')).toHaveText('Laporan diterima. Menunggu verifikasi organizer.');
 expect(reported).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('payment return parameters cannot mark a payment paid',async({page})=>{
 await page.goto('/payment/?status=paid&success=true');
 await expect(page.getByText('Status pembayaran belum tersedia.',{exact:false})).toBeVisible();
 await expect(page).toHaveURL(/\/payment\/$/);
});

test('organizer reviews a report and records partial cash from the event roster',async({page},info)=>{
 const owner='11111111-1111-4111-8111-111111111111',event='22222222-2222-4222-8222-222222222222',charge='33333333-3333-4333-8333-333333333333',method='44444444-4444-4444-8444-444444444444';
 const session={access_token:'finance-browser-fixture',refresh_token:'finance-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner,aud:'authenticated',role:'authenticated',email:'finance@example.invalid',email_confirmed_at:'2026-10-31T00:00:00Z',app_metadata:{provider:'google',providers:['google']},user_metadata:{},identities:[],created_at:'2026-10-31T00:00:00Z'}};
 await page.addInitScript(value=>localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token',JSON.stringify(value)),session);
 const reply=(data:unknown)=>({status:200,contentType:'application/json',body:JSON.stringify({data})});
 await page.route('**/dolend-api/v1/profile',route=>route.fulfill(reply({id:owner,user_id:owner,display_name:'Organizer fixture',email:session.user.email,bio:null,avatar_path:null,default_timezone:'Asia/Jakarta',updated_at:'2026-10-31T00:00:00Z'})));
 await page.route('**/dolend-api/v1/payment-settings',route=>route.fulfill(reply([])));
 await page.route('**/dolend-api/v1/organizer/events',route=>route.fulfill(reply([{id:event,title:'Badminton Jumat'}])));
 await page.route(`**/dolend-api/v1/events/${event}/payment-reviews`,route=>route.fulfill(reply([{id:'pending',amount:2000,status:'pending_verification',proof_url:null}])));
 await page.route(`**/dolend-api/v1/events/${event}/roster`,route=>route.fulfill(reply({participants:[{id:owner,users:{display_name:'Peserta fixture'},participant_charges:{id:charge}}]})));
 await page.route(`**/dolend-api/v1/charges/${charge}`,route=>route.fulfill(reply({methods:[{id:method,type:'cash',recipient_name:'Organizer fixture'}]})));
 let cashRecorded=false;let verified=false;
 await page.route(`**/dolend-api/v1/charges/${charge}/payments`,route=>{expect(route.request().postDataJSON().amount).toBe(1500);cashRecorded=true;return route.fulfill(reply({id:'cash',amount:1500,status:'pending_verification'}));});
 await page.route('**/dolend-api/v1/payments/*/review',route=>{expect(route.request().postDataJSON().decision).toBe('verified');verified=true;return route.fulfill(reply({id:route.request().url().includes('/pending/')?'pending':'cash',amount:2000,status:'verified'}));});
 await page.goto('/account/');
 await page.getByLabel('Event yang dikelola',{exact:true}).selectOption(event);
 await page.getByRole('button',{name:'Muat laporan'}).click();
 await page.getByLabel('Catatan pemeriksaan').fill('Sudah masuk rekening');
 await page.getByRole('button',{name:'Simpan review'}).click();
 await expect(page.getByText('Review tersimpan.',{exact:true})).toBeVisible();
 expect(verified).toBe(true);
 await page.getByLabel('Peserta',{exact:true}).selectOption(charge);
 await page.getByLabel('Nominal diterima (Rp)').fill('1500');
 await page.getByLabel('Catatan penerimaan').fill('Tunai diterima langsung');
 await page.getByRole('button',{name:'Catat tunai diterima'}).click();
 await expect(page.getByText('Penerimaan tunai tercatat dan terverifikasi.',{exact:true})).toBeVisible();
 expect(cashRecorded).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`/tmp/dolend-finance-${info.project.name}.png`,fullPage:true});
});
