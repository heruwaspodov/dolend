import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function WorkspaceFormSection({ id, title, description, children }: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-5 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-10">
      <header>
        <h2 id={id} className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-6 text-[#615d59]">{description}</p>}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export const workspaceFormControl = 'workspace-form-control h-11 w-full min-w-0 rounded-lg border border-[#e6e3df] bg-white px-3 text-base outline-none focus-visible:border-[#0069c7] focus-visible:ring-2 focus-visible:ring-[#0069c7]/30 md:text-sm';
export const workspaceFormAction = 'min-h-11 bg-[#0069c7] px-4 text-white hover:bg-[#0059aa] focus-visible:ring-[#0069c7]';

export const workspaceFormWidth = 'mx-auto w-full max-w-4xl';
export const workspaceFormDividers = 'divide-y divide-[#e6e3df]';
export const workspaceFormPanel = `${workspaceFormDividers} rounded-2xl border border-[#e6e3df] bg-white`;

export function WorkspaceFormHeader({ title, description, icon: Icon, action }: { title: string; description: string; icon: LucideIcon; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <Icon aria-hidden="true" className="size-5 shrink-0 text-[#006bc9]" />
          {title}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-[#615d59]">{description}</p>
      </div>
      {action}
    </header>
  );
}
export const workspaceFormChoice = 'min-h-11 rounded-lg border border-[#e6e3df] bg-white has-checked:border-[#006bc9] has-checked:bg-[#edf5ff]';
