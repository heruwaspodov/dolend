'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

export const defaultWorkspaceNavigationFlags = {
  phase2Network: false,
  phase3Recommendations: false,
  phase3Challenges: false,
  phase3Stats: false,
} as const;

export type WorkspaceNavigationFlag = keyof typeof defaultWorkspaceNavigationFlags;
export type WorkspaceNavigationFlags = Record<WorkspaceNavigationFlag, boolean>;

export async function loadWorkspaceNavigationFlags(): Promise<WorkspaceNavigationFlags> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client
    .from('client_navigation_flags')
    .select('flag_key, enabled');

  if (error) throw error;

  const flags: WorkspaceNavigationFlags = { ...defaultWorkspaceNavigationFlags };
  for (const row of data ?? []) {
    if (row.flag_key in flags) flags[row.flag_key as WorkspaceNavigationFlag] = row.enabled;
  }
  return flags;
}
