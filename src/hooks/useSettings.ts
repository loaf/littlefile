import { useState, useCallback } from 'react';

export interface AppSettings {
  fontSize: number;       // 14
  fontFamily: string;     // '"Microsoft YaHei", sans-serif'
  defaultLibraryPath: string;
  importBatchSize: number; // 500
  language: string;        // 'zh-CN'
}

const DEFAULTS: AppSettings = {
  fontSize: 14, fontFamily: '"Microsoft YaHei", sans-serif',
  defaultLibraryPath: '', importBatchSize: 500, language: 'zh-CN',
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem('littlefile-settings');
    if (saved) return { ...DEFAULTS, ...JSON.parse(saved) };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem('littlefile-settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState({ ...DEFAULTS });
    localStorage.setItem('littlefile-settings', JSON.stringify(DEFAULTS));
  }, []);

  return { settings, updateSettings, resetSettings };
}
