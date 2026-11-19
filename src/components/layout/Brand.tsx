import React from 'react';
import { cn } from '../../lib/utils';

export interface BrandProps {
  className?: string;
  showTagline?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}

export const Brand: React.FC<BrandProps> = ({
  className,
  showTagline = true,
  collapsed = false,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3.5 text-left group focus-ring rounded-[14px] p-1 transition-all duration-150 hover:opacity-95",
        className
      )}
    >
      {/* Brand Icon: Warm architectural shelf & book with terracotta highlight */}
      <div className="w-9 h-9 rounded-[11px] bg-shelf-dark dark:bg-shelf-ivory flex items-center justify-center p-2 shrink-0 transition-transform group-hover:scale-105 shadow-[0_3px_10px_rgba(0,0,0,0.12),0_1px_2px_rgba(201,75,54,0.3)]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-full h-full text-shelf-ivory dark:text-shelf-dark"
        >
          <line x1="3" y1="6" x2="21" y2="6" strokeWidth="2.2" />
          <line x1="3" y1="12" x2="21" y2="12" strokeWidth="2.2" />
          <line x1="3" y1="18" x2="21" y2="18" strokeWidth="2.2" />
          {/* Spine 1: Terracotta */}
          <rect x="6.5" y="6" width="3.5" height="6" rx="0.5" fill="#C94B36" stroke="none" />
          {/* Spine 2: Terracotta accent */}
          <rect x="13.5" y="12" width="3.5" height="6" rx="0.5" fill="#C94B36" stroke="none" fillOpacity="0.8" />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="font-editorial text-[22px] font-medium tracking-tight text-shelf-dark dark:text-shelf-ivory">
            Shelf
          </span>
          {showTagline && (
            <span className="text-[10px] font-sans font-medium tracking-wide text-shelf-muted dark:text-shelf-mutedDark mt-1">
              Everything worth keeping
            </span>
          )}
        </div>
      )}
    </button>
  );
};
