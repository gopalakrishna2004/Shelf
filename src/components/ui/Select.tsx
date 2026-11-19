import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  options,
  label,
  icon,
  className,
  id,
  ...props
}) => {
  return (
    <div className="relative inline-flex items-center">
      {icon && (
        <span className="absolute left-3 text-shelf-muted dark:text-shelf-mutedDark pointer-events-none flex items-center">
          {icon}
        </span>
      )}
      <select
        id={id}
        aria-label={label}
        className={cn(
          "appearance-none bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight dark:border-shelf-borderDark rounded-[11px] text-xs font-medium py-2 pr-8 pl-3 cursor-pointer transition-all duration-150 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-ring hover:border-shelf-stone dark:hover:border-shelf-muted",
          icon ? "pl-8" : undefined,
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory">
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 text-shelf-muted dark:text-shelf-mutedDark pointer-events-none" />
    </div>
  );
};
