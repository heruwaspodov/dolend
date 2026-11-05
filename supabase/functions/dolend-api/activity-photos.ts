import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Elysia, t } from 'elysia';
import type { AccountIdentity, AccountService } from './account.ts';
import type { ObjectStorageRouter } from './object-storage.ts';
import type { PrivateUploadService } from './private-uploads.ts';

const photoReasons = ['privacy','unsafe','spam','copyright','other'] as const;
type PhotoRow = { id:string; activity_id:string; uploader_profile_id:string; storage_reference:string|null; content_type:string; size_bytes:number; width:number; height:number; moderation_status:string; created_at:string; reports?:unknown[] };
export interface ActivityPhotoService {
  invoke<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>;
}
export class ActivityPhotoError extends Error { constructor(public code:string) { super(code); this.name='ActivityPhotoError'; } }

export function createActivityPhotoService(url:string,serviceKey:string):ActivityPhotoService {
  const db:SupabaseClient=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return { async invoke(name,args) {
    const {data,error}=await db.rpc(name,args);
    if(error) {
      const known=error.message.match(/ACTIVITY_PHOTO_[A-Z_]+|INVALID_ACTIVITY_PHOTO(?:_REPORT)?|INVALID_ACTIVITY_PHOTO_ACTION|INVALID_ACTIVITY_PHOTO_LIMIT/ )?.[0];
      throw new ActivityPhotoError(known??'ACTIVITY_PHOTO_STORAGE_UNAVAILABLE');
    }
    return data as never;
  }};
}

function crc32(bytes:Uint8Array) {
  let crc=0xffffffff;
  for(const byte of bytes) { crc^=byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0); }
  return (crc^0xffffffff)>>>0;
}
function concat(parts:Uint8Array[]) {
  const result=new Uint8Array(parts.reduce((size,part)=>size+part.length,0)); let offset=0;
  for(const part of parts) { result.set(part,offset); offset+=part.length; }
  return result;
}
function pngClean(bytes:Uint8Array) {
  const signature=[137,80,78,71,13,10,26,10];
  if(bytes.length<45||!signature.every((byte,index)=>bytes[index]===byte)) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), parts=[bytes.slice(0,8)];
  let offset=8,width=0,height=0,seenHeader=false,seenData=false,seenEnd=false;
  const keep=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','sRGB','gAMA','cHRM','sBIT']);
  while(offset+12<=bytes.length) {
    const length=view.getUint32(offset), type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
    const end=offset+12+length;
    if(end>bytes.length||length>2097152) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    const dataStart=offset+8, dataEnd=dataStart+length, storedCrc=view.getUint32(dataEnd), calculated=crc32(bytes.slice(offset+4,dataEnd));
    if(storedCrc!==calculated) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    if(!seenHeader) {
      if(type!=='IHDR'||length!==13) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
      width=view.getUint32(dataStart); height=view.getUint32(dataStart+4); seenHeader=true;
    }
    if(type==='IDAT') seenData=true;
    if(type==='IEND') { if(length!==0||end!==bytes.length) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO'); seenEnd=true; }
    if(keep.has(type)) parts.push(bytes.slice(offset,end));
    offset=end;
    if(seenEnd) break;
  }
  if(!seenHeader||!seenData||!seenEnd||width<1||height<1||width>8192||height>8192) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  return { bytes:concat(parts), mime:'image/png' as const, extension:'png' as const, width,height };
}

function jpegClean(bytes:Uint8Array) {
  if(bytes.length<64||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  const parts:Uint8Array[]=[bytes.slice(0,2)]; let offset=2,width=0,height=0,hasScan=false;
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  while(offset<bytes.length) {
    if(bytes[offset]!==0xff) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    const markerStart=offset;
    while(offset<bytes.length&&bytes[offset]===0xff) offset++;
    if(offset>=bytes.length) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    const marker=bytes[offset++];
    if(marker===0xd9) { parts.push(bytes.slice(markerStart,offset)); break; }
    if(marker===0x01||(marker>=0xd0&&marker<=0xd7)) { parts.push(bytes.slice(markerStart,offset)); continue; }
    if(offset+2>bytes.length) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    const length=(bytes[offset]<<8)|bytes[offset+1];
    if(length<2||offset+length>bytes.length) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    const segmentEnd=offset+length;
    if(sof.has(marker)) {
      if(length<8) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
      height=(bytes[offset+3]<<8)|bytes[offset+4]; width=(bytes[offset+5]<<8)|bytes[offset+6];
      if(width<1||height<1||width>8192||height>8192) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
    }
    if(marker===0xda) {
      hasScan=true; parts.push(bytes.slice(markerStart,segmentEnd)); let scanEnd=-1;
      for(let index=segmentEnd;index<bytes.length-1;index++) {
        if(bytes[index]!==0xff) continue;
        let markerIndex=index+1; while(markerIndex<bytes.length&&bytes[markerIndex]===0xff) markerIndex++;
        if(markerIndex>=bytes.length) break;
        const scanMarker=bytes[markerIndex];
        if(scanMarker===0x00||(scanMarker>=0xd0&&scanMarker<=0xd7)) {index=markerIndex;continue;}
        scanEnd=index; break;
      }
      if(scanEnd<0) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
      parts.push(bytes.slice(segmentEnd,scanEnd)); offset=scanEnd; continue;
    }
    if(marker!==0xe1&&marker!==0xed&&marker!==0xfe) parts.push(bytes.slice(markerStart,segmentEnd));
    offset=segmentEnd;
  }
  if(!width||!height||!hasScan) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  const clean=concat(parts);
  if(clean.at(-2)!==0xff||clean.at(-1)!==0xd9) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  return { bytes:clean,mime:'image/jpeg' as const,extension:'jpg' as const,width,height };
}

export async function sanitizeActivityPhoto(request:Request) {
  const reader=request.body?.getReader(); if(!reader) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  const chunks:Uint8Array[]=[]; let size=0;
  while(true) { const {value,done}=await reader.read(); if(done) break; size+=value.byteLength; if(size>2097152) { await reader.cancel(); throw new ActivityPhotoError('ACTIVITY_PHOTO_TOO_LARGE'); } chunks.push(value); }
  const bytes=concat(chunks); if(bytes.length<8) throw new ActivityPhotoError('INVALID_ACTIVITY_PHOTO');
  const clean=bytes[0]===137?pngClean(bytes):jpegClean(bytes);
  return {...clean,size:clean.bytes.byteLength};
}

export function activityPhotoRoutes(accounts:AccountService|null,url:string|undefined,serviceKey:string|undefined,storage:ObjectStorageRouter|null,uploads:PrivateUploadService|null,override?:ActivityPhotoService|null) {
  const service=override===undefined&&url&&serviceKey?createActivityPhotoService(url,serviceKey):override;
  async function actor(request:Request):Promise<AccountIdentity|null> {
    const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]; if(!token||!accounts) return null;
    const identity=await accounts.authenticate(token); if(!identity?.googleVerified) return null;
    return await accounts.getProfile(token,identity)?identity:null;
  }
  async function invoke<T>(name:string,args:Record<string,unknown>):Promise<T> {
    if(!service) throw new ActivityPhotoError('ACTIVITY_PHOTO_STORAGE_UNAVAILABLE');
    return await service.invoke<T>(name,args);
  }
  const failure=(error:unknown,set:{status?:number|string})=>{
    if(error instanceof ActivityPhotoError) {
      const code=error.code;
      set.status=code==='ACTIVITY_PHOTO_FORBIDDEN'||code==='ACTIVITY_PHOTO_MODERATOR_REQUIRED'?403:code==='INVALID_ACTIVITY_PHOTO'||code==='INVALID_ACTIVITY_PHOTO_REPORT'||code==='INVALID_ACTIVITY_PHOTO_ACTION'?422:code==='ACTIVITY_PHOTO_TOO_LARGE'?413:code==='ACTIVITY_PHOTO_LIMIT'?409:503;
      return {error:{code,message:'Foto aktivitas belum dapat diproses.'}};
    }
    set.status=503; return {error:{code:'ACTIVITY_PHOTO_STORAGE_UNAVAILABLE',message:'Foto aktivitas belum dapat diproses.'}};
  };
  return new Elysia({aot:false})
    .get('/activities/:id/photos',async({params,request,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      if(!storage) {set.status=503;return {error:{code:'ACTIVITY_PHOTO_STORAGE_UNAVAILABLE',message:'Foto aktivitas belum dapat diproses.'}};}
      try {
        const rows=await invoke<PhotoRow[]>('get_activity_photos',{p_actor:who.id,p_activity:params.id});
        const data=await Promise.all((rows??[]).filter(row=>row.storage_reference).map(async row=>({id:row.id,activity_id:row.activity_id,content_type:row.content_type,size_bytes:row.size_bytes,width:row.width,height:row.height,moderation_status:row.moderation_status,created_at:row.created_at,url:await storage?.signedDownloadUrl(row.storage_reference!,120)})));
        return {data};
      } catch(error) {return failure(error,set);}
    },{params:t.Object({id:t.String({format:'uuid'})})})
    .post('/activities/:id/photos',async({params,request,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      if(request.headers.get('x-photo-consent')!=='true') {set.status=422;return {error:{code:'PHOTO_CONSENT_REQUIRED',message:'Konfirmasi izin membagikan foto diperlukan.'}};}
      if(!storage||!uploads) {set.status=503;return {error:{code:'ACTIVITY_PHOTO_STORAGE_UNAVAILABLE',message:'Foto aktivitas belum dapat diproses.'}};}
      try {
        const photo=await sanitizeActivityPhoto(request),id=crypto.randomUUID(),key=`activity-photos/${who.id}/${id}.${photo.extension}`;
        const reference=await uploads.upload({key,purpose:'activity_photo',ownerProfileId:who.id,object:{bytes:photo.bytes,contentType:photo.mime}});
        const row=await invoke<PhotoRow>('attach_activity_photo',{p_actor:who.id,p_activity:params.id,p_upload:reference,p_content_type:photo.mime,p_size:photo.size,p_width:photo.width,p_height:photo.height,p_consented_at:new Date().toISOString()});
        set.status=201;
        return {data:{id:row.id,activity_id:row.activity_id,content_type:row.content_type,size_bytes:row.size_bytes,width:row.width,height:row.height,moderation_status:row.moderation_status,url:await storage.signedDownloadUrl(reference,120)}};
      } catch(error) {return failure(error,set);}
    },{params:t.Object({id:t.String({format:'uuid'})}),parse:'none'})
    .delete('/activities/:id/photos/:photoId',async({params,request,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      try {
        const removed=await invoke<boolean>('delete_activity_photo',{p_actor:who.id,p_activity:params.id,p_photo:params.photoId});
        if(!removed) {set.status=404;return {error:{code:'ACTIVITY_PHOTO_NOT_FOUND',message:'Foto tidak ditemukan.'}};}
        return {data:{deleted:true}};
      } catch(error) {return failure(error,set);}
    },{params:t.Object({id:t.String({format:'uuid'}),photoId:t.String({format:'uuid'})})})
    .post('/activities/:id/photos/:photoId/reports',async({params,request,body,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      try {return {data:await invoke<boolean>('report_activity_photo',{p_actor:who.id,p_activity:params.id,p_photo:params.photoId,p_reason:body.reason,p_details:body.details??''})};}
      catch(error) {return failure(error,set);}
    },{params:t.Object({id:t.String({format:'uuid'}),photoId:t.String({format:'uuid'})}),body:t.Object({reason:t.Union(photoReasons.map(reason=>t.Literal(reason))),details:t.Optional(t.String({maxLength:500}))})})
    .get('/activities/moderation/photos',async({request,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      if(!storage) {set.status=503;return {error:{code:'ACTIVITY_PHOTO_STORAGE_UNAVAILABLE',message:'Foto aktivitas belum dapat diproses.'}};}
      try {
        const rows=await invoke<PhotoRow[]>('activity_photo_moderation_queue',{p_actor:who.id,p_limit:50});
        const data=await Promise.all((rows??[]).filter(row=>row.storage_reference).map(async row=>({photo_id:row.id,activity_id:row.activity_id,uploader_profile_id:row.uploader_profile_id,content_type:row.content_type,size_bytes:row.size_bytes,width:row.width,height:row.height,created_at:row.created_at,reports:row.reports??[],url:await storage?.signedDownloadUrl(row.storage_reference!,120)})));
        return {data};
      } catch(error) {return failure(error,set);}
    })
    .post('/activities/moderation/photos/:photoId/review',async({params,request,body,set})=>{
      const who=await actor(request); if(!who) {set.status=401;return {error:{code:'UNAUTHORIZED',message:'Silakan masuk.'}};}
      try {return {data:await invoke<boolean>('review_activity_photo',{p_actor:who.id,p_photo:params.photoId,p_action:body.action})};}
      catch(error) {return failure(error,set);}
    },{params:t.Object({photoId:t.String({format:'uuid'})}),body:t.Object({action:t.Union([t.Literal('dismiss'),t.Literal('hide'),t.Literal('remove')])})});
}
