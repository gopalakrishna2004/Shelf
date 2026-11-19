import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-150 focus-ring disabled:opacity-45 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none select-none tracking-tight";

  const sizeStyles = {
    xs: "text-[11px] px-2.5 py-1 rounded-[10px] gap-1.5 leading-none",
    sm: "text-xs px-3.5 py-1.5 rounded-[11px] gap-1.5 leading-tight",
    md: "text-xs sm:text-sm px-4 py-2 rounded-[12px] gap-2 leading-tight",
    lg: "text-sm sm:text-base px-5 py-2.5 rounded-[14px] gap-2.5 leading-tight",
  }[size];

  const variantStyles = {
    primary: "bg-shelf-terracotta text-white shadow-[0_4px_0_#962D1D,0_6px_18px_rgba(201,75,54,0.42)] dark:shadow-[0_4px_0_#751E11,0_6px_18px_rgba(201,75,54,0.32)] hover:bg-shelf-terracottaHover hover:-translate-y-[1px] hover:shadow-[0_5px_0_#962D1D,0_8px_24px_rgba(201,75,54,0.50)] dark:hover:shadow-[0_5px_0_#751E11,0_8px_24px_rgba(201,75,54,0.40)] active:translate-y-[2px] active:shadow-[0_1px_0_#962D1D,0_2px_6px_rgba(201,75,54,0.28)] dark:active:shadow-[0_1px_0_#751E11,0_2px_6px_rgba(201,75,54,0.22)]",
    secondary: "bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory border border-shelf-borderLight/80 dark:border-shelf-borderDark/90 shadow-[0_2px_0_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.02)] dark:shadow-[0_2px_0_rgba(0,0,0,0.25)] hover:border-shelf-terracotta/40 dark:hover:border-shelf-terracotta/40 hover:text-shelf-terracotta dark:hover:text-shelf-terracotta hover:bg-shelf-surfaceSubtle dark:hover:bg-white/[0.04] hover:-translate-y-[1px] active:translate-y-[1px] active:shadow-none",
    ghost: "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta dark:hover:text-shelf-terracotta hover:bg-shelf-terracottaMuted/30 dark:hover:bg-white/[0.04] active:bg-shelf-terracottaMuted/50 active:translate-y-[0.5px]",
    outline: "border border-shelf-terracotta/50 text-shelf-terracotta hover:bg-shelf-terracottaMuted hover:border-shelf-terracotta hover:-translate-y-[1px] active:translate-y-[1px]",
    danger: "bg-[#B03A2B] text-white shadow-[0_3px_0_rgba(145,41,29,0.5),0_4px_12px_rgba(176,58,43,0.2)] hover:bg-[#9B3023] hover:-translate-y-[1px] hover:shadow-[0_4px_0_rgba(145,41,29,0.6)] active:translate-y-[2px] active:shadow-[0_1px_0_rgba(145,41,29,0.5)]",
  }[variant];

  return (
    <button
      className={cn(baseStyles, sizeStyles, variantStyles, className)}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
