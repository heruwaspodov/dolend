export type Activity = {
  id: string; author_profile_id: string; author_name?: string; body: string;
  visibility: 'public' | 'followers' | 'community' | 'private'; community_id: string | null;
  community_name?: string | null; source_event_id: string | null; source_event_title?: string | null;
  created_at: string; updated_at: string; is_own?: boolean;
};
export type ActivityInput = { body: string; visibility: Activity['visibility']; community_id?: string | null; source_event_id?: string | null };
export type ActivityPage = { items: Activity[]; next_cursor: string | null };
export type ActivityPhoto = { id:string; activity_id:string; content_type:string; size_bytes:number; width:number; height:number; moderation_status:string; created_at:string; url:string };

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error('Konfigurasi API belum tersedia.');
  const response = await fetch(`${base}/activities${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Aktivitas belum dapat diproses.');
  return payload.data as T;
}

export const getActivityFeed = (token: string, cursor?: string, signal?: AbortSignal) => {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  return request<ActivityPage>(token, `/feed?${query}`, { signal });
};
export const publishActivity = (token: string, key: string, input: ActivityInput) => request<Activity>(token, '', {
  method: 'POST', headers: { 'idempotency-key': key }, body: JSON.stringify(input),
});
export const editActivity = (token: string, id: string, input: ActivityInput) => request<Activity>(token, `/${encodeURIComponent(id)}`, {
  method: 'PATCH', body: JSON.stringify(input),
});
export const deleteActivity = (token: string, id: string) => request<{ deleted: boolean }>(token, `/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const reportActivity = (token: string, id: string, reason: string, details: string) => request<{ reported: boolean }>(token, `/${encodeURIComponent(id)}/report`, {
  method: 'POST', body: JSON.stringify({ reason, details }),
});
export const getActivityPhotos = (token:string,id:string) => request<ActivityPhoto[]>(token,`/${encodeURIComponent(id)}/photos`);
export const uploadActivityPhoto = (token:string,id:string,file:File) => request<ActivityPhoto>(token,`/${encodeURIComponent(id)}/photos`,{
  method:'POST',headers:{'content-type':file.type,'x-photo-consent':'true'},body:file,
});
export const deleteActivityPhoto = (token:string,id:string,photoId:string) => request<{deleted:boolean}>(token,`/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,{method:'DELETE'});
export const reportActivityPhoto = (token:string,id:string,photoId:string) => request<boolean>(token,`/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}/reports`,{method:'POST',body:JSON.stringify({reason:'privacy'})});
export const getPhotoModerationQueue = (token:string) => request<Array<ActivityPhoto & {photo_id:string;reports:Array<{reason:string;details:string}>}>>(token,'/moderation/photos');
export const reviewActivityPhoto = (token:string,photoId:string,action:'dismiss'|'hide'|'remove') => request<boolean>(token,`/moderation/photos/${encodeURIComponent(photoId)}/review`,{method:'POST',body:JSON.stringify({action})});
