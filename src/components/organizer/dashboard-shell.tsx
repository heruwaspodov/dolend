'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  Compass,
  LayoutDashboard,
  LogOut,
  Menu,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import {
  defaultWorkspaceNavigationFlags,
  loadWorkspaceNavigationFlags,
  type WorkspaceNavigationFlag,
  type WorkspaceNavigationFlags,
} from '@/lib/workspace-navigation-flags';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useOrganizerSession } from '@/lib/use-organizer-session';

type NavigationLink = { href: string; label: string; icon: typeof LayoutDashboard; feature?: WorkspaceNavigationFlag };
type NavigationSection = { label: string; feature?: WorkspaceNavigationFlag; links: NavigationLink[] };

const navigation: NavigationSection[] = [
  {
    label: 'MENU UTAMA',
    links: [
      { href: '/account/', label: 'Akun', icon: UserRound },
      { href: '/dashboard/', label: 'Ringkasan', icon: LayoutDashboard },
      { href: '/dashboard/events/', label: 'My Event', icon: CalendarDays },
    ],
  },
  {
    label: 'JARINGAN',
    feature: 'phase2Network',
    links: [
      { href: '/feed/', label: 'Aktivitas', icon: Activity },
      { href: '/communities/', label: 'Komunitas', icon: UsersRound },
      { href: '/social/', label: 'Teman', icon: UsersRound },
    ],
  },
  {
    label: 'JELAJAH',
    links: [
      { href: '/recommendations/', label: 'Temukan aktivitas', icon: Compass, feature: 'phase3Recommendations' },
      { href: '/challenges/', label: 'Tantangan', icon: Trophy, feature: 'phase3Challenges' },
      { href: '/stats/', label: 'Statistik', icon: ChartNoAxesColumnIncreasing, feature: 'phase3Stats' },
    ],
  },
];

function NavigationLinks({ pathname, flags, onNavigate }: { pathname: string; flags: WorkspaceNavigationFlags; onNavigate?: () => void }) {
  const currentPath = pathname.replace(/\/+$/, '') || '/';
  const visibleSections = navigation
    .map((section) => ({ ...section, links: section.links.filter((link) => !link.feature || flags[link.feature]) }))
    .filter((section) => (!section.feature || flags[section.feature]) && section.links.length > 0);
  return <nav aria-label="Navigasi utama" className="space-y-6">
    {visibleSections.map((section) => <section key={section.label}>
      <h2 className="mb-2 px-3 text-[11px] font-semibold tracking-[0.12em] text-[#615d59]">{section.label}</h2>
      <ul className="space-y-1">
        {section.links.map(({ href, label, icon: Icon }) => {
          const destination = href.replace(/\/+$/, '') || '/';
          const active = href.includes('#')
            ? currentPath === '/event/manage'
            : currentPath === destination || (destination !== '/dashboard' && currentPath.startsWith(`${destination}/`));
          return <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de] ${active ? 'bg-[#e8f3fd] font-medium text-[#005bab]' : 'text-[#4e4b48] hover:bg-[#f0efed] hover:text-[#171615]'}`}
            >
              <Icon aria-hidden="true" className={`size-[18px] shrink-0 ${active ? 'text-[#0075de]' : 'text-[#77736f]'}`} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight aria-hidden="true" className="size-4 text-[#0075de]" />}
            </Link>
          </li>;
        })}
      </ul>
    </section>)}
  </nav>;
}

export function OrganizerDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useOrganizerSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigationFlags, setNavigationFlags] = useState<WorkspaceNavigationFlags>({ ...defaultWorkspaceNavigationFlags });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    let active = true;
    void loadWorkspaceNavigationFlags()
      .then((flags) => { if (active) setNavigationFlags(flags); })
      .catch(() => { if (active) setNavigationFlags({ ...defaultWorkspaceNavigationFlags }); });
    return () => { active = false; };
  }, []);

  async function signOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut();
      if (error) throw error;
      router.replace('/account/');
    } catch {
      setSignOutError('Belum berhasil keluar. Coba lagi.');
    } finally {
      setSigningOut(false);
    }
  }

  const logoutButton = <button type="button" onClick={() => void signOut()} disabled={signingOut} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-[#4e4b48] transition-colors hover:bg-[#f6f5f4] hover:text-[#171615] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de] disabled:opacity-60">
    <LogOut aria-hidden="true" className="size-[18px] shrink-0 text-[#77736f]" />
    <span>{signingOut ? 'Keluar…' : 'Keluar'}</span>
  </button>;

  return <div className="min-h-dvh bg-[#f6f5f4] text-[#211f1d] lg:flex">
    <aside aria-label="Menu dashboard" className="fixed inset-y-0 left-0 z-20 hidden w-[252px] flex-col border-r border-[#e6e6e6] bg-white px-4 py-5 lg:flex">
      <Link href="/dashboard/" className="mb-8 flex items-center gap-3 rounded-lg px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de]">
        <span className="grid size-9 place-items-center rounded-xl bg-[#0075de] text-lg font-bold text-white">d</span>
        <span><span className="block text-lg font-semibold tracking-[-0.04em] text-[#171615]">dolend.</span><span className="block text-xs text-[#77736f]">Ruang aktivitasmu</span></span>
      </Link>
      <NavigationLinks pathname={pathname} flags={navigationFlags} />
      <div className="mt-auto border-t border-[#e6e6e6] pt-4">
        {session && signOutError && <p className="mb-2 px-3 text-xs text-[#9a332c]" role="alert">{signOutError}</p>}
        {session && logoutButton}
      </div>
    </aside>

    <div className="min-w-0 flex-1 lg:pl-[252px]">
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-[#e6e6e6] bg-white/95 px-4 backdrop-blur sm:px-7 lg:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/" className="text-xl font-semibold tracking-[-0.05em] text-[#171615]" aria-label="Dolend, ringkasan">dolend.</Link>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg text-[#31302e] hover:bg-[#f6f5f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0075de] lg:hidden"
            aria-label={menuOpen ? 'Tutup menu dashboard' : 'Buka menu dashboard'}
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </header>

      <div id="mobile-dashboard-navigation" className={`${menuOpen ? 'block' : 'hidden'} border-b border-[#e6e6e6] bg-white px-4 py-5 lg:hidden`}>
        <NavigationLinks pathname={pathname} flags={navigationFlags} onNavigate={() => setMenuOpen(false)} />
        <div className="mt-5 border-t border-[#e6e6e6] pt-4">
          {session && signOutError && <p className="mb-2 px-3 text-xs text-[#9a332c]" role="alert">{signOutError}</p>}
          {session && logoutButton}
        </div>
      </div>

      <main className="w-full px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  </div>;
}
