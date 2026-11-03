export type OwnParticipation={
  id:string;
  status:string;
  joined_as?:'guest'|'member';
  hold_expires_at:string|null;
  confirmed_at:string|null;
  cancelled_at?:string|null;
  updated_at:string;
};

function apiUrl(path:string) {
  const base=process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/,'');
  if(!base)throw new Error('Konfigurasi partisipasi belum tersedia.');
  return `${base}${path}`;
}

function publicHeaders() {
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!key)throw new Error('Konfigurasi partisipasi belum tersedia.');
  return {apikey:key,...(key.startsWith('eyJ')?{authorization:`Bearer ${key}`}:{})};
}

async function data<T>(response:Response):Promise<T> {
  const payload=await response.json().catch(()=>null);
  if(!response.ok) {
    const error=new Error(payload?.error?.message??'Partisipasi belum dapat diproses.');
    Object.assign(error,{code:payload?.error?.code,status:response.status});
    throw error;
  }
  return payload.data as T;
}

export async function getMemberParticipation(eventId:string,accessToken:string,signal?:AbortSignal) {
  return data<OwnParticipation|null>(await fetch(apiUrl(`/events/${eventId}/participation`),{cache:'no-store',signal,headers:{...publicHeaders(),authorization:`Bearer ${accessToken}`}}));
}

export async function joinEventAsMember(eventId:string,accessToken:string,inviteToken?:string) {
  return data<OwnParticipation>(await fetch(apiUrl(`/events/${eventId}/join`),{method:'POST',cache:'no-store',headers:{...publicHeaders(),authorization:`Bearer ${accessToken}`,...(inviteToken?{'x-invite-token':inviteToken}:{})}}));
}

export async function cancelMemberParticipation(eventId:string,accessToken:string,reason:string) {
  return data<OwnParticipation>(await fetch(apiUrl(`/events/${eventId}/participation/cancel`),{method:'POST',cache:'no-store',headers:{...publicHeaders(),authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({reason})}));
}

export async function cancelGuestParticipation(eventId:string,bookingToken:string,reason:string) {
  return data<OwnParticipation>(await fetch(apiUrl(`/events/${eventId}/participation/cancel`),{method:'POST',cache:'no-store',headers:{...publicHeaders(),'x-booking-token':bookingToken,'content-type':'application/json'},body:JSON.stringify({reason})}));
}
