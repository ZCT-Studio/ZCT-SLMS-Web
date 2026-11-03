import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
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
  values?: string[];
  onValuesChange?: (values: string[]) => void;
};
export function CustomSelect({
  options,
  value,
  defaultValue = "",
  onChange,
  name,
  placeholder = "请选择",
  disabled,
  ariaLabel,
  className = "",
  values,
  onValuesChange,
}: Props) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    [internal, setInternal] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [position, setPosition] = useState<{
      left: number;
      top: number;
      width: number;
      maxHeight: number;
    } | null>(null);
  const selected = value ?? internal,
    current = options.find((option) => option.value === selected);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (
        !root.current?.contains(e.target as Node) &&
        !menu.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewTop = window.visualViewport?.offsetTop || 0,
        viewBottom =
          viewTop + (window.visualViewport?.height || window.innerHeight),
        viewportWidth = document.documentElement.clientWidth;
      if (rect.bottom < viewTop || rect.top > viewBottom) {
        setOpen(false);
        return;
      }
      const desired = Math.min(240, Math.max(46, options.length * 36 + 12)),
        below = viewBottom - rect.bottom - 12,
        above = rect.top - viewTop - 12,
        up = below < desired && above > below,
        maxHeight = Math.max(46, Math.min(desired, up ? above : below)),
        width = Math.min(Math.max(rect.width, 150), viewportWidth - 20),
        left = Math.max(10, Math.min(rect.left, viewportWidth - width - 10)),
        top = up ? rect.top - maxHeight - 6 : rect.bottom + 6;
      setPosition((previous) =>
        previous &&
        previous.left === left &&
        previous.top === top &&
        previous.width === width &&
        previous.maxHeight === maxHeight
          ? previous
          : { left, top, width, maxHeight },
      );
    };
    update();
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      document.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [open, options.length]);
  useEffect(() => {
    if (open && position) {
      const option =
        menu.current?.querySelector<HTMLButtonElement>(
          '[aria-selected="true"]:not(:disabled)',
        ) ||
        menu.current?.querySelector<HTMLButtonElement>(
          '[role="option"]:not(:disabled)',
        );
      option?.focus({ preventScroll: true });
    }
  }, [open, !!position]);
  const choose = (next: string) => {
    if (values) {
      onValuesChange?.(
        next === "__ALL__"
          ? []
          : values.includes(next)
            ? values.filter((v) => v !== next)
            : [...values, next],
      );
      return;
    }
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  function keys(e: React.KeyboardEvent) {
    if (
      ["Escape", "Tab", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
    )
      e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else if (e.key === "Tab") {
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const items = Array.from(
        menu.current?.querySelectorAll<HTMLButtonElement>(
          '[role="option"]:not(:disabled)',
        ) || [],
      );
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement),
        next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? items.length - 1
              : (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length;
      items[next].focus({ preventScroll: true });
      items[next].scrollIntoView({ block: "nearest" });
    }
  }
  return (
    <div
      ref={root}
      className={`custom-select ${open ? "open" : ""} ${className}`}
      onKeyDown={keys}
    >
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        ref={trigger}
        id={`${id}-trigger`}
        type="button"
        className="custom-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        onClick={() => {
          setPosition(null);
          setOpen((v) => !v);
        }}
      >
        <span className={current || values?.length ? "" : "placeholder"}>
          {values
            ? values.length
              ? options
                  .filter((o) => values.includes(o.value))
                  .map((o) => o.label)
                  .join("、")
              : placeholder
            : (current?.label ?? placeholder)}
        </span>
        <ChevronDown size={15} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menu}
            id={`${id}-list`}
            className="custom-select-menu"
            role="listbox"
            aria-multiselectable={values ? true : undefined}
            aria-labelledby={`${id}-trigger`}
            onKeyDown={keys}
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              width: position.width,
              maxHeight: position.maxHeight,
              zIndex: 1300,
            }}
          >
            {options.length ? (
              options.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={
                    values
                      ? option.value === "__ALL__"
                        ? !values.length
                        : values.includes(option.value)
                      : option.value === selected
                  }
                  disabled={option.disabled}
                  key={option.value}
                  className={
                    (
                      values
                        ? option.value === "__ALL__"
                          ? !values.length
                          : values.includes(option.value)
                        : option.value === selected
                    )
                      ? "selected"
                      : ""
                  }
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {(values
                    ? option.value === "__ALL__"
                      ? !values.length
                      : values.includes(option.value)
                    : option.value === selected) && <Check size={14} />}
                </button>
              ))
            ) : (
              <div className="custom-select-empty">暂无选项</div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
