'use client';

import { Children, isValidElement, useId, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import Select, { components, type ControlProps } from 'react-select';

type SelectOption = { label: string; value: string; disabled?: boolean };

function SearchControl(props: ControlProps<SelectOption, false>) {
  return (
    <components.Control {...props}>
      {props.selectProps.menuIsOpen && <Search aria-hidden="true" className="mr-2 size-4 shrink-0 text-[#615d59]" />}
      {props.children}
    </components.Control>
  );
}

type OptionProps = { value?: string | number; children: ReactNode; disabled?: boolean };
type SearchableSelectProps = {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  children: ReactNode;
};

export function SearchableSelect({
  id, name, value, defaultValue, onValueChange, required, disabled, className,
  placeholder = 'Pilih opsi…', 'aria-label': ariaLabel, children,
}: SearchableSelectProps) {
  const generatedId = useId();
  const [selection, setSelection] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<OptionProps>(child) || child.type !== 'option') return [];
    const label = Children.toArray(child.props.children).join('');
    return [{ label, value: String(child.props.value ?? label), disabled: child.props.disabled }];
  });
  const emptyOption = options.find(option => option.value === '');
  const selected = options.find(option => option.value === String(value ?? selection))
    ?? (value === undefined ? options.find(option => !option.disabled) : undefined);

  return (
    <Select<SelectOption, false>
      components={{ Control: SearchControl }}
      menuIsOpen={open}
      onMenuOpen={() => setOpen(true)}
      onMenuClose={() => setOpen(false)}
      controlShouldRenderValue={!open}
      instanceId={id ?? generatedId}
      inputId={id ?? generatedId}
      aria-label={ariaLabel}
      name={name}
      className={className}
      options={required ? options.filter(option => option.value !== '') : options}
      value={required && selected?.value === '' ? null : selected ?? null}
      isOptionDisabled={option => Boolean(option.disabled)}
      onChange={option => {
        setSelection(option?.value);
        onValueChange?.(option?.value ?? '');
      }}
      placeholder={open ? 'Cari pilihan…' : emptyOption?.label ?? placeholder}
      noOptionsMessage={() => 'Tidak ada pilihan yang cocok.'}
      required={required}
      isDisabled={disabled}
      isSearchable
      menuPlacement="auto"
      unstyled
      classNames={{
        container: () => 'min-w-0',
        control: ({ isFocused, isDisabled }) => `!min-h-11 rounded-lg border bg-white px-3 text-base md:text-sm ${isFocused ? 'border-[#0069c7] ring-2 ring-[#0069c7]/30' : 'border-[#e6e3df]'} ${isDisabled ? 'opacity-60' : ''}`,
        placeholder: () => 'text-[#615d59]',
        dropdownIndicator: () => 'ml-1 shrink-0 text-[#615d59]',
        menu: () => '!z-20 my-1 overflow-hidden rounded-lg border border-[#e6e3df] bg-white shadow-md',
        option: ({ isFocused, isSelected }) => `min-h-11 px-3 py-3 text-sm ${isFocused || isSelected ? 'bg-[#edf5ff] text-[#004780]' : ''}`,
        noOptionsMessage: () => 'px-3 py-3 text-sm text-[#615d59]',
      }}
    />
  );
}
