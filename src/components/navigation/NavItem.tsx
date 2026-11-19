import React from 'react';
import { cn } from '../../lib/utils';

export interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
  badge?: string;
  collapsed?: boolean;
}

export const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  isActive,
  onClick,
  count,
  badge,
  collapsed = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        "w-full flex items-center text-xs sm:text-sm font-medium rounded-[12px] transition-all duration-150 focus-ring group select-none relative",
        collapsed ? "justify-center h-10 px-0" : "gap-3 px-3.5 py-2.5 text-left",
        isActive
          ? "bg-white dark:bg-shelf-surfaceDark text-shelf-dark dark:text-shelf-ivory font-semibold border border-shelf-terracotta/25 dark:border-shelf-terracotta/35 shadow-[0_2px_12px_rgba(36,35,33,0.06),0_1px_4px_rgba(201,75,54,0.18)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
          : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory hover:bg-shelf-stone/20 dark:hover:bg-white/[0.04]"
      )}
    >
      {/* Terracotta active indicator bar */}
      {isActive && (
        <span
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-shelf-terracotta shadow-[0_0_8px_rgba(201,75,54,0.5)]"
          aria-hidden="true"
        />
      )}

      <span
        className={cn(
          "shrink-0 transition-colors",
          isActive
            ? "text-shelf-terracotta"
            : "text-shelf-muted dark:text-shelf-mutedDark group-hover:text-shelf-terracotta/90"
        )}
      >
        {icon}
      </span>

      {!collapsed && (
        <span className="truncate flex-1 tracking-tight">
          {label}
        </span>
      )}

      {!collapsed && count !== undefined && count > 0 && (
        <span
          className={cn(
            "font-mono text-[11px] px-2 py-0.5 rounded-full transition-colors",
            isActive
              ? "bg-shelf-terracottaMuted text-shelf-terracotta font-semibold"
              : "bg-shelf-stone/30 dark:bg-shelf-borderDark text-shelf-muted dark:text-shelf-mutedDark"
          )}
        >
          {count}
        </span>
      )}

      {!collapsed && badge && (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-shelf-terracottaMuted text-shelf-terracotta font-semibold">
          {badge}
        </span>
      )}
    </button>
  );
};
