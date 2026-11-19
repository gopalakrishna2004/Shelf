import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import type { Theme } from '../../types';
import { cn } from '../../lib/utils';

export interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  variant?: 'compact' | 'segmented';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onThemeChange,
  variant = 'compact'
}) => {
  if (variant === 'segmented') {
    return (
      <div className="inline-flex items-center p-1 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[14px] bg-shelf-surfaceLight dark:bg-shelf-surfaceDark shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={() => onThemeChange('light')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all duration-150 focus-ring",
            theme === 'light'
              ? "bg-shelf-terracotta text-white shadow-[0_2px_6px_rgba(201,75,54,0.3)]"
              : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory"
          )}
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => onThemeChange('dark')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all duration-150 focus-ring",
            theme === 'dark'
              ? "bg-shelf-terracotta text-white shadow-[0_2px_6px_rgba(201,75,54,0.3)]"
              : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory"
          )}
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => onThemeChange('system')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[10px] transition-all duration-150 focus-ring",
            theme === 'system'
              ? "bg-shelf-terracotta text-white shadow-[0_2px_6px_rgba(201,75,54,0.3)]"
              : "text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory"
          )}
        >
          <Laptop className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>
    );
  }

  // Compact button that toggles between dark and light with subtle terracotta highlight
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="p-2 border border-shelf-borderLight/80 dark:border-shelf-borderDark/80 rounded-[12px] bg-shelf-surfaceLight dark:bg-shelf-surfaceDark text-shelf-muted dark:text-shelf-mutedDark hover:text-shelf-dark dark:hover:text-shelf-ivory hover:border-shelf-terracotta/50 hover:shadow-[0_2px_8px_rgba(201,75,54,0.15)] transition-all duration-150 focus-ring"
    >
      {isDark ? <Sun className="w-4 h-4 text-shelf-terracotta" /> : <Moon className="w-4 h-4 text-shelf-dark" />}
    </button>
  );
};
