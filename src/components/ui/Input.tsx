import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  className,
  icon,
  rightElement,
  error,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 text-shelf-muted dark:text-shelf-mutedDark pointer-events-none flex items-center shrink-0">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory placeholder:text-shelf-muted/60 dark:placeholder:text-shelf-mutedDark/50 border border-shelf-borderLight dark:border-shelf-borderDark rounded-[12px] text-xs sm:text-sm py-2.5 transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-ring hover:border-shelf-stone dark:hover:border-shelf-muted",
            icon ? "pl-10" : "pl-3.5",
            rightElement ? "pr-10" : "pr-3.5",
            error && "border-shelf-terracotta focus-visible:ring-shelf-terracotta",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-[11px] font-mono text-shelf-terracotta pl-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
