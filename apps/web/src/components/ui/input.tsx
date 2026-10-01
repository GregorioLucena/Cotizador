'use client';

import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { messageFromValidity, useFieldError } from '@/components/ui/field-error';

const controlClass =
  'min-h-11 w-full rounded-xl border border-borde bg-white px-3.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition placeholder:text-muted focus:border-teal focus:ring-2 focus:ring-teal/20';

const controlErrorClass =
  'border-peligro/60 bg-peligro/[0.03] focus:border-peligro focus:ring-peligro/20';

export function getControlClassName(hasError?: boolean) {
  return cn(controlClass, hasError && controlErrorClass);
}

function useInlineValidity(
  onInvalid?: (e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
  onInput?: (e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void,
) {
  const fieldError = useFieldError();

  return {
    onInvalid: (
      e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      if (fieldError) {
        e.preventDefault();
        fieldError.setError(messageFromValidity(e.currentTarget));
      }
      onInvalid?.(e);
    },
    onInput: (
      e: FormEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      fieldError?.setError(undefined);
      onInput?.(e);
    },
    hasError: Boolean(fieldError?.hasError),
  };
}

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function parseSelectOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    }>;
    if (el.type !== 'option') return;
    out.push({
      value: el.props.value == null ? '' : String(el.props.value),
      label: String(el.props.children ?? ''),
      disabled: Boolean(el.props.disabled),
    });
  });
  return out;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, required, onInvalid, onInput, ...props }, ref) {
    const validity = useInlineValidity(onInvalid, onInput);
    return (
      <input
        ref={ref}
        className={cn(getControlClassName(validity.hasError), className)}
        required={required}
        {...props}
        onInvalid={validity.onInvalid}
        onInput={validity.onInput}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(
    {
      className,
      children,
      required,
      onInvalid,
      onInput,
      onChange,
      onBlur,
      disabled,
      value,
      defaultValue,
      id,
      name,
      ...props
    },
    ref,
  ) {
    const validity = useInlineValidity(onInvalid, onInput);
    const options = useMemo(() => parseSelectOptions(children), [children]);
    const listId = useId();
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const hiddenRef = useRef<HTMLSelectElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [abierto, setAbierto] = useState(false);
    const [menuPos, setMenuPos] = useState<{
      left: number;
      width: number;
      maxHeight: number;
      top?: number;
      bottom?: number;
    } | null>(null);

    const controlado = value !== undefined;
    const [interno, setInterno] = useState(() =>
      defaultValue == null ? String(options[0]?.value ?? '') : String(defaultValue),
    );
    const actual = controlado ? String(value) : interno;

    useImperativeHandle(ref, () => hiddenRef.current as HTMLSelectElement);

    const seleccion = options.find((o) => o.value === actual) ?? options[0];
    const etiqueta = seleccion?.label ?? '—';

    const actualizarPosicion = useCallback(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom - 12;
      const espacioArriba = rect.top - 12;
      const abrirArriba = espacioAbajo < 220 && espacioArriba > espacioAbajo;
      const maxHeight = Math.min(
        280,
        Math.max(140, abrirArriba ? espacioArriba : espacioAbajo),
      );
      setMenuPos({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(abrirArriba
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    }, []);

    useLayoutEffect(() => {
      if (!abierto) {
        setMenuPos(null);
        return;
      }
      actualizarPosicion();
      const onScroll = () => actualizarPosicion();
      window.addEventListener('resize', onScroll);
      window.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('resize', onScroll);
        window.removeEventListener('scroll', onScroll, true);
      };
    }, [abierto, actualizarPosicion]);

    useEffect(() => {
      if (!abierto) return;
      function onPointer(e: MouseEvent) {
        const t = e.target as Node;
        if (rootRef.current?.contains(t)) return;
        if (listRef.current?.contains(t)) return;
        setAbierto(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setAbierto(false);
          triggerRef.current?.focus();
        }
      }
      document.addEventListener('mousedown', onPointer);
      document.addEventListener('keydown', onKey);
      return () => {
        document.removeEventListener('mousedown', onPointer);
        document.removeEventListener('keydown', onKey);
      };
    }, [abierto]);

    function emitirCambio(next: string) {
      if (!controlado) setInterno(next);
      const select = hiddenRef.current;
      if (select) {
        const proto = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value',
        );
        proto?.set?.call(select, next);
        const event = {
          target: select,
          currentTarget: select,
          type: 'change',
          bubbles: true,
          cancelable: false,
          defaultPrevented: false,
          eventPhase: 0,
          isTrusted: false,
          nativeEvent: new Event('change'),
          preventDefault() {},
          isDefaultPrevented() {
            return false;
          },
          stopPropagation() {},
          isPropagationStopped() {
            return false;
          },
          persist() {},
          timeStamp: Date.now(),
        } as ChangeEvent<HTMLSelectElement>;
        onChange?.(event);
        onInput?.(event as unknown as FormEvent<HTMLSelectElement>);
      }
    }

    function elegir(next: string) {
      if (disabled) return;
      emitirCambio(next);
      setAbierto(false);
      triggerRef.current?.focus();
    }

    return (
      <div ref={rootRef} className="relative">
        <select
          {...props}
          ref={hiddenRef}
          id={id}
          name={name}
          required={required}
          disabled={disabled}
          value={actual}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          onChange={onChange}
          onInvalid={validity.onInvalid}
          onInput={validity.onInput}
          onBlur={onBlur}
        >
          {children}
        </select>

        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={abierto}
          aria-controls={listId}
          className={cn(
            getControlClassName(validity.hasError),
            'flex items-center justify-between gap-3 pr-3.5 text-left',
            abierto && 'border-teal ring-2 ring-teal/20',
            disabled && 'cursor-not-allowed opacity-55',
            className,
          )}
          onClick={() => {
            if (disabled) return;
            setAbierto((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setAbierto(true);
            }
          }}
        >
          <span className="min-w-0 flex-1 truncate">{etiqueta}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-slate transition-transform duration-200',
              abierto && 'rotate-180 text-teal',
            )}
          />
        </button>

        {abierto && menuPos
          ? createPortal(
              <ul
                ref={listRef}
                id={listId}
                role="listbox"
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  bottom: menuPos.bottom,
                  left: menuPos.left,
                  width: menuPos.width,
                  maxHeight: menuPos.maxHeight,
                }}
                className="z-[80] overflow-auto rounded-xl border border-borde/90 bg-surface p-1.5 shadow-[0_22px_50px_-24px_rgba(18,32,30,0.55)] ring-1 ring-black/5 animate-rise"
              >
                {options.map((opt) => {
                  const activo = opt.value === actual;
                  return (
                    <li key={`${opt.value}::${opt.label}`} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={activo}
                        disabled={opt.disabled}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                          opt.disabled && 'cursor-not-allowed opacity-40',
                          activo
                            ? 'bg-teal font-semibold text-white'
                            : 'text-ink hover:bg-teal/8',
                        )}
                        onClick={() => {
                          if (!opt.disabled) elegir(opt.value);
                        }}
                      >
                        <span className="min-w-0 truncate">{opt.label}</span>
                        {activo ? (
                          <Check className="size-4 shrink-0 opacity-90" aria-hidden />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>,
              document.body,
            )
          : null}
      </div>
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, required, onInvalid, onInput, ...props }, ref) {
  const validity = useInlineValidity(onInvalid, onInput);
  return (
    <textarea
      ref={ref}
      className={cn(getControlClassName(validity.hasError), 'min-h-28 py-3', className)}
      required={required}
      {...props}
      onInvalid={validity.onInvalid}
      onInput={validity.onInput}
    />
  );
});
