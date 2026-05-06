import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface ScanResult {
  file_count: number;
  total_size: number;
}

export interface ImportProgress {
  total: number;
  completed: number;
  current_file: string;
  elapsed_secs: number;
  estimated_remaining_secs: number;
  paused: boolean;
}

export interface ImportErrorItem {
  file: string;
  error: string;
}

export interface ImportSummary {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportErrorItem[];
}

export type ImportPhase = 'idle' | 'scanning' | 'ready' | 'importing' | 'paused' | 'complete';

export function useImport() {
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [errors, setErrors] = useState<ImportErrorItem[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  const cleanup = useCallback(async () => {
    for (const fn of unlistenRef.current) {
      fn();
    }
    unlistenRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const scan = useCallback(async (path: string) => {
    setPhase('scanning');
    setScanResult(null);
    setErrors([]);
    setSummary(null);
    try {
      const result = await invoke<ScanResult>('scan_import_path', { path });
      setScanResult(result);
      setPhase('ready');
    } catch (e) {
      setPhase('idle');
      throw e;
    }
  }, []);

  const start = useCallback(async (
    path: string,
    options: { batch_size: number; dedup_strategy: string; delete_after_import: boolean },
  ) => {
    await cleanup();

    const progressUnlisten = await listen<ImportProgress>('import:progress', (event) => {
      setProgress(event.payload);
    });
    const errorUnlisten = await listen<ImportErrorItem>('import:error', (event) => {
      setErrors((prev) => [...prev, event.payload]);
    });
    const completeUnlisten = await listen<ImportSummary>('import:complete', (event) => {
      setSummary(event.payload);
      setPhase('complete');
    });

    unlistenRef.current = [progressUnlisten, errorUnlisten, completeUnlisten];

    setPhase('importing');
    setProgress(null);
    setErrors([]);
    setSummary(null);

    try {
      await invoke('start_import', { path, options });
    } catch (e) {
      setPhase('idle');
      throw e;
    }
  }, [cleanup]);

  const pause = useCallback(async () => {
    await invoke('pause_import');
    setPhase('paused');
  }, []);

  const resume = useCallback(async () => {
    await invoke('resume_import');
    setPhase('importing');
  }, []);

  const cancel = useCallback(async () => {
    await invoke('cancel_import');
  }, []);

  const reset = useCallback(async () => {
    await cleanup();
    setPhase('idle');
    setScanResult(null);
    setProgress(null);
    setErrors([]);
    setSummary(null);
  }, [cleanup]);

  return {
    phase,
    scanResult,
    progress,
    errors,
    summary,
    scan,
    start,
    pause,
    resume,
    cancel,
    reset,
  };
}
