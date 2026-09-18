import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-brass text-ink font-bold shadow-[0_10px_28px_-12px_rgba(240,162,2,0.55)] hover:bg-brass-dark hover:text-white',
  secondary:
    'border border-borde bg-surface text-ink font-semibold hover:border-teal/40 hover:bg-white',
  ghost: 'bg-transparent text-ink font-semibold hover:bg-teal/8',
  danger: 'bg-peligro/10 text-peligro font-semibold hover:bg-peligro/15',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ className, variant = 'primary', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm transition disabled:opacity-55',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});
