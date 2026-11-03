import { createClient } from '@supabase/supabase-js';

export type EventInviteService = {
  canAccess(eventId:string,inviteToken?:string|null,bookingToken?:string|null):Promise<boolean>;
};

const tokenPattern=/^[A-Za-z0-9_-]{43}$/;

async function sha256(value:string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function createSupabaseEventInviteService(url:string,serviceRoleKey:string):EventInviteService {
  const client=createClient(url,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
  return {
    async canAccess(eventId,inviteToken,bookingToken) {
      const {data:event,error}=await client.from('events').select('visibility,status').eq('id',eventId).maybeSingle();
      if(error)throw new Error('INVITE_STORAGE_UNAVAILABLE');
      if(!event||!['published','recruiting','confirmed','completed'].includes(event.status))return false;
      if(event.visibility==='public')return true;
      if(inviteToken&&tokenPattern.test(inviteToken)) {
        const {data,error:verifyError}=await client.rpc('verify_event_invite',{p_event:eventId,p_token_hash:await sha256(inviteToken)});
        if(verifyError)throw new Error('INVITE_STORAGE_UNAVAILABLE');
        if(data===true)return true;
      }
      if(bookingToken&&tokenPattern.test(bookingToken)) {
        const {data,error:bookingError}=await client.rpc('get_guest_booking',{p_event:eventId,p_token_hash:await sha256(bookingToken)});
        if(bookingError)throw new Error('INVITE_STORAGE_UNAVAILABLE');
        return Array.isArray(data)&&data.length>0;
      }
      return false;
    },
  };
}
