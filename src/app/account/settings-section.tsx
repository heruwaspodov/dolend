import type { ReactNode } from 'react';

export function SettingsSection({ id, title, description, children }: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
      <header>
        <h2 id={id} className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export const settingsControl = 'h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-[#0069c7] focus-visible:ring-2 focus-visible:ring-[#0069c7]/30 md:text-sm';
export const settingsAction = 'min-h-11 bg-[#0069c7] px-4 text-white hover:bg-[#0059aa] focus-visible:ring-[#0069c7]';
