import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import type { ViewMode } from '../../types';
import { cn } from '../../lib/utils';

export interface ViewModeSwitcherProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export const ViewModeSwitcher: React.FC<ViewModeSwitcherProps> = ({ viewMode, onChange }) => {
  return (
    <div
      role="group"
      aria-label="View layout switch"
      className="inline-flex items-center p-1 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] bg-shelf-surfaceLight dark:bg-shelf-surfaceDark shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={viewMode === 'grid'}
        title="Grid view"
        className={cn(
          "p-1.5 rounded-[9px] transition-all duration-150 focus-ring",
          viewMode === 'grid'
            ? "bg-shelf-terracotta text-white shadow-[0_2px_8px_rgba(201,75,54,0.35)]"
            : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={viewMode === 'list'}
        title="List view"
        className={cn(
          "p-1.5 rounded-[9px] transition-all duration-150 focus-ring",
          viewMode === 'list'
            ? "bg-shelf-terracotta text-white shadow-[0_2px_8px_rgba(201,75,54,0.35)]"
            : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-terracotta"
        )}
      >
        <List className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
