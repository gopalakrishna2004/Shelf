import { useState, useEffect } from 'react';

const PREFERENCE_OPEN_IN_NEW_TAB_KEY = 'shelf-open-new-tab-preference';
const LEGACY_STORAGE_KEY = 'shelf-open-new-tab';

export function usePreferences() {
  const [openInNewTab, setOpenInNewTabState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(PREFERENCE_OPEN_IN_NEW_TAB_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch {
      // Ignore localStorage errors
    }
    return true; // Default to true: open in separate tab
  });

  const setOpenInNewTab = (val: boolean) => {
    setOpenInNewTabState(val);
    try {
      localStorage.setItem(PREFERENCE_OPEN_IN_NEW_TAB_KEY, String(val));
      localStorage.setItem(LEGACY_STORAGE_KEY, String(val));
      window.dispatchEvent(new Event('shelf-preference-change'));
    } catch {
      // Ignore localStorage errors
    }
  };

  useEffect(() => {
    const handleSync = () => {
      try {
        const stored = localStorage.getItem(PREFERENCE_OPEN_IN_NEW_TAB_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
        if (stored !== null) {
          setOpenInNewTabState(stored === 'true');
        }
      } catch {
        // Ignore
      }
    };

    window.addEventListener('shelf-preference-change', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('shelf-preference-change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  return {
    openInNewTab,
    setOpenInNewTab,
  };
}
