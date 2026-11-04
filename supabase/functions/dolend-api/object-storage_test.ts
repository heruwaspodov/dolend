import { createObjectStorageFromEnv, ObjectStorageConfigurationError, ObjectStorageRouter, type ObjectStorageBackend } from './object-storage.ts';

function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
class MemoryBackend implements ObjectStorageBackend {
  objects=new Map<string,Uint8Array>();
  async put(key:string,input:{bytes:Uint8Array}) {this.objects.set(key,input.bytes);}
  async remove(key:string) {this.objects.delete(key);}
  async exists(key:string) {return this.objects.has(key);}
  async signedDownloadUrl(key:string,expiresIn:number) {return `https://storage.example/${key}?expires=${expiresIn}`;}
}

Deno.test('storage router keeps Supabase references backward compatible and prefixes S3',async()=>{
  const supabase=new MemoryBackend(),s3=new MemoryBackend();
  const supabaseRouter=new ObjectStorageRouter('supabase',{supabase,s3});
  const legacy=await supabaseRouter.put('proof/charge/file.png',{bytes:new Uint8Array([1]),contentType:'image/png'});
  assert(legacy==='proof/charge/file.png','Supabase reference changed');
  assert(await supabaseRouter.exists(legacy),'legacy Supabase reference missing');
  const s3Router=new ObjectStorageRouter('s3',{supabase,s3});
  const migrated=await s3Router.put('proof/charge/new.png',{bytes:new Uint8Array([2]),contentType:'image/png'});
  assert(migrated==='s3:proof/charge/new.png','S3 reference not namespaced');
  assert(s3Router.referenceForKey('proof/charge/new.png')===migrated,'S3 reference cannot be reserved before upload');
  assert(s3Router.logicalKey(migrated)==='proof/charge/new.png','logical key changed');
  assert((await s3Router.signedDownloadUrl(migrated,120)).includes('expires=120'),'signed URL unavailable');
  assert(await s3Router.exists(legacy),'Supabase fallback unavailable during migration');
  await s3Router.remove(migrated);
  assert(!await s3Router.exists(migrated),'S3 object was not removed');
});

Deno.test('storage router rejects traversal and unavailable providers',async()=>{
  const supabase=new MemoryBackend();
  const router=new ObjectStorageRouter('supabase',{supabase});
  for(const reference of ['../secret','proof//file.png','s3:proof/file.png']) {
    let rejected=false;try{router.logicalKey(reference);}catch{rejected=true;}
    assert(rejected,`unsafe reference accepted: ${reference}`);
  }
});

Deno.test('storage configuration defaults to Supabase and validates explicit S3',()=>{
  const values=new Map<string,string>();
  const read=(name:string)=>values.get(name);
  const fallback=createObjectStorageFromEnv(read,{url:'https://example.supabase.co',serviceKey:'fixture'});
  assert(fallback?.logicalKey('qris/owner/file.png')==='qris/owner/file.png','Supabase default unavailable');
  values.set('STORAGE_PROVIDER','s3');
  let rejected=false;try{createObjectStorageFromEnv(read,{url:'https://example.supabase.co',serviceKey:'fixture'});}catch(error){rejected=error instanceof ObjectStorageConfigurationError;}
  assert(rejected,'incomplete S3 configuration accepted');
});
