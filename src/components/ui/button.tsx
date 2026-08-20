import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'disabled:pointer-events-none disabled:opacity-50 ring-offset-background',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_16px_40px_oklch(0.52_0.105_223.128/0.18)] hover:bg-primary-dark hover:text-primary-foreground',
        secondary:
          'border border-slate-200 bg-slate-100 text-slate-950 hover:border-slate-300 hover:bg-slate-200 hover:text-slate-950',
        outline:
          'border border-slate-200 bg-white text-slate-950 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-[#ff5b43]',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
