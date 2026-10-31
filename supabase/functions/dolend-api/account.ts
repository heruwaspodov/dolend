import { createClient } from '@supabase/supabase-js';

export type AccountIdentity = {
  id: string;
  email: string | null;
  googleVerified: boolean;
};

export type Profile = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  phone_normalized: string | null;
  bio: string | null;
  avatar_path: string | null;
  default_timezone: string;
  updated_at: string;
};

export type ProfilePatch = {
  bio?: string | null;
  avatar_path?: string | null;
  default_timezone?: string;
};

export interface AccountService {
  authenticate(token: string): Promise<AccountIdentity | null>;
  bootstrapProfile(token: string, identity: AccountIdentity): Promise<Profile | null>;
  getProfile(token: string, identity: AccountIdentity): Promise<Profile | null>;
  updateProfile(token: string, identity: AccountIdentity, patch: ProfilePatch): Promise<Profile | null>;
}

export class AccountServiceError extends Error {
  constructor(public code: 'IDENTITY_MISMATCH' | 'INVALID_PROFILE' | 'ACCOUNT_STORAGE_UNAVAILABLE') {
    super(code);
    this.name = 'AccountServiceError';
  }
}

const profileSelect = 'id,user_id,auth_provider,bio,avatar_path,default_timezone,updated_at,users!inner(display_name,phone_normalized,state)';

function mapProfile(row: Record<string, unknown>, identity: AccountIdentity): Profile {
  const relation = Array.isArray(row.users) ? row.users[0] : row.users;
  const user = relation as Record<string, unknown> | null;
  if (
    row.id !== identity.id || row.auth_provider !== 'google' || !identity.email || !user || user.state !== 'active'
  ) {
    throw new AccountServiceError('IDENTITY_MISMATCH');
  }
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    display_name: String(user.display_name),
    email: identity.email,
    phone_normalized: user.phone_normalized === null ? null : String(user.phone_normalized),
    bio: row.bio === null ? null : String(row.bio),
    avatar_path: row.avatar_path === null ? null : String(row.avatar_path),
    default_timezone: String(row.default_timezone),
    updated_at: String(row.updated_at),
  };
}

export function createSupabaseAccountService(url: string, publishableKey: string): AccountService {
  const client = (token: string) => createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return {
    async authenticate(token) {
      const { data, error } = await client(token).auth.getUser(token);
      if (error || !data.user) return null;
      const providers = Array.isArray(data.user.app_metadata.providers) ? data.user.app_metadata.providers : [];
      const googleVerified = Boolean(
        data.user.email_confirmed_at &&
        (data.user.app_metadata.provider === 'google' || providers.includes('google'))
      );
      return {
        id: data.user.id,
        email: data.user.email ?? null,
        googleVerified,
      };
    },
    async bootstrapProfile(token, identity) {
      const supabase = client(token);
      const { error } = await supabase.rpc('bootstrap_google_profile');
      if (error) {
        throw new AccountServiceError(error.message.includes('GOOGLE_ACCOUNT_REQUIRED') ? 'IDENTITY_MISMATCH' : 'ACCOUNT_STORAGE_UNAVAILABLE');
      }
      const { data, error: profileError } = await supabase.from('profiles').select(profileSelect).eq('id', identity.id).maybeSingle();
      if (profileError) throw new AccountServiceError('ACCOUNT_STORAGE_UNAVAILABLE');
      return data ? mapProfile(data, identity) : null;
    },
    async getProfile(token, identity) {
      const { data, error } = await client(token).from('profiles').select(profileSelect).eq('id', identity.id).maybeSingle();
      if (error) throw new AccountServiceError('ACCOUNT_STORAGE_UNAVAILABLE');
      return data ? mapProfile(data, identity) : null;
    },
    async updateProfile(token, identity, patch) {
      const { data, error } = await client(token).from('profiles').update(patch).eq('id', identity.id).select(profileSelect).maybeSingle();
      if (error) throw new AccountServiceError(error.message.includes('INVALID_TIMEZONE') ? 'INVALID_PROFILE' : 'ACCOUNT_STORAGE_UNAVAILABLE');
      return data ? mapProfile(data, identity) : null;
    },
  };
}
