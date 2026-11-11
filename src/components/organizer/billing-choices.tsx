import { cn } from '@/lib/utils';
import { workspaceFormChoice } from './workspace-form';

export function BillingChoices<Value extends string>({ legend, name, options, value, onChange, inline }: {
  legend: string;
  name: string;
  options: readonly { value: Value; label: string; hint?: string }[];
  value: Value;
  onChange: (value: Value) => void;
  inline?: boolean;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn('grid gap-2', inline && 'grid-cols-2')}>
        {options.map(option => (
          <label key={option.value} className={cn(workspaceFormChoice, 'flex cursor-pointer items-start gap-3 px-3 py-2.5')}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              aria-labelledby={`${name}-${option.value}-label`}
              aria-describedby={option.hint ? `${name}-${option.value}-hint` : undefined}
              className="mt-0.5 size-4 shrink-0 accent-[#006bc9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006bc9]"
            />
            <span className="min-w-0 text-sm">
              <span id={`${name}-${option.value}-label`} className="block font-semibold">{option.label}</span>
              {option.hint && <span id={`${name}-${option.value}-hint`} className="mt-0.5 block leading-relaxed text-[#615d59]">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
