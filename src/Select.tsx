import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption = { value: string; label: string; disabled?: boolean };

type Props = {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function CustomSelect({
  options,
  value,
  defaultValue = '',
  onChange,
  name,
  placeholder = '请选择',
  disabled,
  ariaLabel,
  className = '',
}: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = value ?? internal;
  const current = options.find(option => option.value === selected);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const choose = (next: string) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setOpen(false);
  };

  return (
    <div ref={root} className={`custom-select ${open ? 'open' : ''} ${className}`}>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => setOpen(previous => !previous)}
      >
        <span className={current ? '' : 'placeholder'}>{current?.label ?? placeholder}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div id={`${id}-list`} className="custom-select-menu" role="listbox">
          {options.length ? options.map(option => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === selected}
              className={option.value === selected ? 'selected' : ''}
              disabled={option.disabled}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              <span>{option.label}</span>
              {option.value === selected && <Check size={14} />}
            </button>
          )) : <div className="custom-select-empty">暂无选项</div>}
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle-switch ${checked ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
