import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const inviteToken='i'.repeat(43);
const session={
  access_token:'member-browser-token',refresh_token:'member-browser-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,
  user:{id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'member@example.com',email_confirmed_at:'2026-11-03T00:00:00.000Z',app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Member Dolend'},identities:[],created_at:'2026-11-03T00:00:00.000Z'},
};

test('akun Google yang juga organizer dapat ikut dan membatalkan partisipasi sendiri',async({page})=>{
  await page.addInitScript(({value})=>localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token',JSON.stringify(value)),{value:session});
  let joined=false;let cancellation:Record<string,unknown>|undefined;
  await page.route(url=>url.pathname.includes(`/events/${eventId}`),async route=>{
    const request=route.request(),url=new URL(request.url());
    if(request.method()==='OPTIONS')return route.fulfill({status:204});
    if(url.pathname.endsWith('/participation')&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:joined?{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'confirmed',joined_as:'member',hold_expires_at:null,confirmed_at:'2026-11-03T01:00:00Z',updated_at:'2026-11-03T01:00:00Z'}:null})});
    if(url.pathname.endsWith('/join')&&request.method()==='POST'){
      expect(request.headers()['authorization']).toBe('Bearer member-browser-token');expect(request.headers()['x-invite-token']).toBe(inviteToken);joined=true;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'confirmed',joined_as:'member',hold_expires_at:null,confirmed_at:'2026-11-03T01:00:00Z',updated_at:'2026-11-03T01:00:00Z'}})});
    }
    if(url.pathname.endsWith('/participation/cancel')&&request.method()==='POST'){
      cancellation=request.postDataJSON();joined=false;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',status:'cancelled',joined_as:'member',hold_expires_at:null,confirmed_at:null,cancelled_at:'2026-11-03T02:00:00Z',updated_at:'2026-11-03T02:00:00Z'}})});
    }
    expect(request.headers()['x-invite-token']).toBe(inviteToken);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId,title:'Lari Minggu',description:'Lari santai.',starts_at:'2026-11-09T00:00:00Z',ends_at:'2026-11-09T02:00:00Z',timezone:'Asia/Jakarta',capacity:10,participants_count:2,venue:{name:'GBK',address:'Jakarta',maps_url:''},price_amount:0,currency:'IDR'}})});
  });
  await page.goto(`/event/?id=${eventId}#invite=${inviteToken}`);
  await expect(page.getByRole('heading',{name:'Ikut sebagai member'})).toBeVisible();
  await page.getByRole('button',{name:'Ikut event'}).click();
  await expect(page.getByText('Kamu sudah terdaftar sebagai peserta.')).toBeVisible();
  await page.locator('summary').filter({hasText:'Batalkan partisipasi'}).click();
  await page.getByLabel('Alasan').fill('Ada agenda keluarga');
  await page.getByRole('button',{name:'Batalkan partisipasi'}).click();
  await expect(page.getByRole('heading',{name:'Ikut sebagai member'})).toBeVisible();
  expect(cancellation).toEqual({reason:'Ada agenda keluarga'});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});
