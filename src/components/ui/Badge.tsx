import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'stone' | 'outline';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  icon,
}) => {
  const variantStyles = {
    default: "bg-shelf-stone/30 dark:bg-shelf-surfaceDark text-shelf-dark/85 dark:text-shelf-ivory/85 border border-shelf-borderLight/70 dark:border-shelf-borderDark",
    accent: "bg-shelf-terracottaMuted text-shelf-terracotta border border-shelf-terracotta/20 font-medium",
    stone: "bg-shelf-stone/40 text-shelf-dark dark:bg-shelf-surfaceDark dark:text-shelf-ivory border border-shelf-borderLight/60 dark:border-shelf-borderDark",
    outline: "border border-shelf-borderLight dark:border-shelf-borderDark text-shelf-muted dark:text-shelf-mutedDark bg-transparent",
  }[variant];

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono tracking-tight rounded-full select-none", variantStyles, className)}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};
