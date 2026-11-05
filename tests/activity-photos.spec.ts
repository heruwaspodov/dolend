import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';

const actor='11111111-1111-4111-8111-111111111111',activity='33333333-3333-4333-8333-333333333333',photo='44444444-4444-4444-8444-444444444444';
async function setSession(page:Page) {
  const expiresAt=Math.floor(Date.now()/1000)+3600;
  const session={access_token:'photo-browser-token',refresh_token:'photo-browser-refresh',token_type:'bearer',expires_in:3600,expires_at:expiresAt,user:{id:actor,aud:'authenticated',role:'authenticated',email:'photo@example.test',email_confirmed_at:'2026-11-05T00:00:00.000Z',app_metadata:{provider:'google',providers:['google']},user_metadata:{full_name:'Photo Fixture'},identities:[],created_at:'2026-11-05T00:00:00.000Z'}};
  await page.addInitScript(({value})=>localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token',JSON.stringify(value)),{value:session});
}

test('photo sharing requires consent and displays the cleaned private upload',async({page})=>{
  await setSession(page);let uploaded=false,consentHeader='';
  await page.route(/\/activities\//,async route=>{
    const request=route.request(),url=new URL(request.url());let data:unknown=[];
    if(url.pathname.endsWith('/activities/feed')) data={items:[{id:activity,author_profile_id:actor,author_name:'Kamu',body:'Jalan pagi',visibility:'followers',community_id:null,source_event_id:null,created_at:'2026-11-05T00:00:00.000Z',updated_at:'2026-11-05T00:00:00.000Z',is_own:true}],next_cursor:null};
    else if(url.pathname.endsWith(`/activities/${activity}/photos`)&&request.method()==='POST') {uploaded=true;consentHeader=request.headers()['x-photo-consent']??'';data={id:photo,activity_id:activity,content_type:'image/png',size_bytes:100,width:1,height:1,moderation_status:'visible',created_at:'2026-11-05T00:00:00.000Z',url:'https://storage.example/activity-photo.png?expires=120'};}
    else if(url.pathname.endsWith(`/activities/${activity}/photos`)) data=uploaded?[{id:photo,activity_id:activity,content_type:'image/png',size_bytes:100,width:1,height:1,moderation_status:'visible',created_at:'2026-11-05T00:00:00.000Z',url:'https://storage.example/activity-photo.png?expires=120'}]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})});
  });
  await page.route('https://storage.example/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}));
  await page.goto('/feed/');
  const input=page.getByLabel('Pilih foto aktivitas');
  await expect(input).toBeDisabled();
  await input.setInputFiles({name:'walk.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await expect(page.getByText('Konfirmasi izin membagikan foto terlebih dahulu.')).toBeVisible();
  await page.getByLabel('Saya memiliki izin untuk membagikan foto ini.').check();
  await input.setInputFiles({name:'walk.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
  await expect(page.getByRole('img',{name:'Foto aktivitas'})).toBeVisible();
  expect(uploaded).toBeTruthy();expect(consentHeader).toBe('true');
});
