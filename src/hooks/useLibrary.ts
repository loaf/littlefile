import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface LibraryInfo {
  name: string; description: string; total_files: number;
  total_size: number; total_compressed_size: number;
  total_tags: number; db_file_size: number; created_at: string;
  path: string;
}

export function useLibrary() {
  const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);
  const openLibrary = useCallback(async (path: string) => {
    const info = await invoke<LibraryInfo>('open_library', { options: { path } });
    setLibraryInfo(info);
  }, []);
  const closeLibrary = useCallback(async () => {
    await invoke('close_library');
    setLibraryInfo(null);
  }, []);
  const refreshInfo = useCallback(async () => {
    const info = await invoke<LibraryInfo>('get_library_info');
    setLibraryInfo(info);
  }, []);
  return { libraryInfo, openLibrary, closeLibrary, refreshInfo };
}
