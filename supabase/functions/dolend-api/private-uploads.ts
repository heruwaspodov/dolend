import { createClient } from '@supabase/supabase-js';
import type { ObjectStorageRouter, StoredObjectInput } from './object-storage.ts';

export type PrivateUploadPurpose = 'qris' | 'payment_proof';
export type PrivateUploadInput = {
  key: string;
  purpose: PrivateUploadPurpose;
  ownerProfileId?: string | null;
  chargeId?: string | null;
  object: StoredObjectInput;
};
type ClaimedUpload = {storage_reference:string};
export type CleanupResult = {claimed:number;deleted:number;failed:number};

export interface PrivateUploadService {
  upload(input:PrivateUploadInput):Promise<string>;
  cleanup(limit?:number):Promise<CleanupResult>;
}

export class PrivateUploadError extends Error {}

export function createSupabasePrivateUploadService(url:string,serviceKey:string,storage:ObjectStorageRouter):PrivateUploadService {
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return {
    async upload(input) {
      const reference=storage.referenceForKey(input.key);
      const {error}=await db.from('private_uploads').insert({
        storage_reference:reference,purpose:input.purpose,owner_profile_id:input.ownerProfileId??null,
        charge_id:input.chargeId??null,content_type:input.object.contentType,size_bytes:input.object.bytes.byteLength,
      });
      if(error)throw new PrivateUploadError('UPLOAD_REGISTRY_UNAVAILABLE');
      try {
        await storage.put(input.key,input.object);
        return reference;
      } catch {
        await db.from('private_uploads').delete().eq('storage_reference',reference).is('attached_at',null);
        throw new PrivateUploadError('OBJECT_STORAGE_UNAVAILABLE');
      }
    },
    async cleanup(limit=100) {
      if(!Number.isInteger(limit)||limit<1||limit>500)throw new PrivateUploadError('INVALID_CLEANUP_LIMIT');
      const {data,error}=await db.rpc('claim_expired_private_uploads',{p_limit:limit});
      if(error)throw new PrivateUploadError('UPLOAD_REGISTRY_UNAVAILABLE');
      const claimed=(data??[]) as ClaimedUpload[];
      let deleted=0,failed=0;
      for(const upload of claimed) {
        try {
          await storage.remove(upload.storage_reference);
          const {error:deleteError}=await db.from('private_uploads').delete().eq('storage_reference',upload.storage_reference).is('attached_at',null);
          if(deleteError)throw deleteError;
          deleted++;
        } catch {
          failed++;
          await db.from('private_uploads').update({cleanup_started_at:null}).eq('storage_reference',upload.storage_reference).is('attached_at',null);
        }
      }
      return {claimed:claimed.length,deleted,failed};
    },
  };
}
