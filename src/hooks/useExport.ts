import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

export interface ExportProgress { total: number; completed: number; current_file: string; }
export type ExportPhase = 'idle' | 'exporting' | 'complete';

export function useExport() {
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  const cancel = useCallback(() => {
    unlistenRef.current.forEach(fn => fn());
    unlistenRef.current = [];
    setPhase('idle');
    setProgress(null);
  }, []);

  useEffect(() => { return () => { cancel(); }; }, [cancel]);

  const startExport = useCallback(async (fileIds: number[], targetDir: string, encoding: string) => {
    unlistenRef.current.forEach(fn => fn());
    unlistenRef.current = [];
    setPhase('exporting');
    try {
      const p = await listen<ExportProgress>('export:progress', e => setProgress(e.payload));
      const c = await listen('export:complete', () => setPhase('complete'));
      unlistenRef.current = [p, c];
      await invoke('export_files', { options: { file_ids: fileIds, target_dir: targetDir, encoding } });
    } catch (e) {
      setPhase('idle');
      throw e;
    }
  }, []);

  return { phase, progress, startExport, cancel };
}
