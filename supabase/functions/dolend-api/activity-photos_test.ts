import { assertEquals } from 'jsr:@std/assert@1.0.14';
import type { AccountIdentity, AccountService, Profile } from './account.ts';
import { activityPhotoRoutes, sanitizeActivityPhoto, type ActivityPhotoService } from './activity-photos.ts';
import { ObjectStorageRouter, type ObjectStorageBackend } from './object-storage.ts';
import type { PrivateUploadService } from './private-uploads.ts';

const actor='123e4567-e89b-42d3-a456-426614174000',activity='223e4567-e89b-42d3-a456-426614174000',photo='323e4567-e89b-42d3-a456-426614174000';
const identity:AccountIdentity={id:actor,email:'photo@example.test',googleVerified:true};
const profile:Profile={id:actor,user_id:'423e4567-e89b-42d3-a456-426614174000',display_name:'Foto Uji',email:identity.email!,phone_normalized:null,bio:null,avatar_path:null,default_timezone:'Asia/Jakarta',updated_at:'2026-11-05T00:00:00.000Z'};
const accounts:AccountService={authenticate:async token=>token==='valid'?identity:null,bootstrapProfile:async()=>profile,getProfile:async()=>profile,updateProfile:async()=>profile};
function crc32(bytes:Uint8Array) {let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type:string,data:Uint8Array) {const typeBytes=new TextEncoder().encode(type),length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,data.length);const payload=new Uint8Array([...typeBytes,...data]),crc=new Uint8Array(4);new DataView(crc.buffer).setUint32(0,crc32(payload));return new Uint8Array([...length,...payload,...crc]);}
function pngWithMetadata() {
  const source=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),char=>char.charCodeAt(0));
  const view=new DataView(source.buffer,source.byteOffset,source.byteLength),parts=[source.slice(0,8)];let offset=8;
  while(offset+12<=source.length) {const size=view.getUint32(offset),type=new TextDecoder().decode(source.slice(offset+4,offset+8));if(type==='IEND')break;parts.push(chunk(type,source.slice(offset+8,offset+8+size)));offset+=size+12;}
  return new Uint8Array([...parts.flatMap(part=>[...part]),...chunk('eXIf',new TextEncoder().encode('GPS fixture')),...chunk('IEND',new Uint8Array())]);
}
class MemoryStorage implements ObjectStorageBackend {
  objects=new Map<string,Uint8Array>();
  async put(key:string,input:{bytes:Uint8Array}) {this.objects.set(key,input.bytes);}
  async remove(key:string) {this.objects.delete(key);}
  async exists(key:string) {return this.objects.has(key);}
  async signedDownloadUrl(key:string,expiresIn:number) {return `https://storage.example/${key}?expires=${expiresIn}`;}
}

Deno.test('activity photo sanitizer strips PNG EXIF and validates dimensions and CRC',async()=>{
  const input=pngWithMetadata(),clean=await sanitizeActivityPhoto(new Request('http://localhost/upload',{method:'POST',body:input}));
  assertEquals(clean.mime,'image/png');assertEquals(clean.width,1);assertEquals(clean.height,1);
  const text=new TextDecoder().decode(clean.bytes);
  assertEquals(text.includes('eXIf'),false);assertEquals(text.includes('GPS fixture'),false);
  let rejected=false;try{await sanitizeActivityPhoto(new Request('http://localhost/upload',{method:'POST',body:new Uint8Array([1,2,3,4,5,6,7,8])}));}catch{rejected=true;}
  assertEquals(rejected,true);
});

Deno.test('photo upload requires verified actor and explicit consent; stored object is metadata-cleaned',async()=>{
  const storageBackend=new MemoryStorage(),storage=new ObjectStorageRouter('supabase',{supabase:storageBackend});
  const captured:{args?:Record<string,unknown>;storedText:string}={storedText:''};
  const uploads:PrivateUploadService={async upload(input){captured.storedText=new TextDecoder().decode(input.object.bytes);await storage.put(input.key,input.object);return input.key;},async cleanup(){return {claimed:0,deleted:0,failed:0};}};
  const service:ActivityPhotoService={async invoke<T>(name:string,args:Record<string,unknown>):Promise<T>{if(name==='attach_activity_photo'){captured.args=args;return {id:photo,activity_id:activity,content_type:'image/png',size_bytes:args.p_size,width:1,height:1,moderation_status:'visible',created_at:'2026-11-05T00:00:00Z'} as T;}if(name==='get_activity_photos')return [{id:photo,activity_id:activity,content_type:'image/png',size_bytes:100,width:1,height:1,moderation_status:'visible',created_at:'2026-11-05T00:00:00Z',storage_reference:'activity-photos/object.png'}] as T;throw new Error(name);}};
  const app=activityPhotoRoutes(accounts,undefined,undefined,storage,uploads,service);
  const missing=await app.handle(new Request(`http://localhost/activities/${activity}/photos`,{method:'POST',headers:{authorization:'Bearer valid','content-type':'image/png'},body:pngWithMetadata()}));
  assertEquals(missing.status,422);
  const unauthorized=await app.handle(new Request(`http://localhost/activities/${activity}/photos`,{method:'POST',headers:{authorization:'Bearer invalid','content-type':'image/png','x-photo-consent':'true'},body:pngWithMetadata()}));
  assertEquals(unauthorized.status,401);
  const response=await app.handle(new Request(`http://localhost/activities/${activity}/photos`,{method:'POST',headers:{authorization:'Bearer valid','content-type':'image/png','x-photo-consent':'true'},body:pngWithMetadata()}));
  assertEquals(response.status,201);assertEquals(captured.storedText.includes('eXIf'),false);assertEquals(captured.args?.p_actor,actor);assertEquals(captured.args?.p_activity,activity);
  const listed=await app.handle(new Request(`http://localhost/activities/${activity}/photos`,{headers:{authorization:'Bearer valid'}}));
  const payload=await listed.json();assertEquals(payload.data[0].url.includes('expires=120'),true);assertEquals('storage_reference' in payload.data[0],false);
});
