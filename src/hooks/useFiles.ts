import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface FileFilter {
  filenameQuery?: string;
  authorQuery?: string;
  descriptionQuery?: string;
  tagIds?: number[];
  tagFilterMode?: 'AND' | 'OR';
  sizeMin?: number;
  sizeMax?: number;
  dateFrom?: string;
  dateTo?: string;
  encodingFilter?: string;
  hasDescription?: boolean;
  hasTags?: boolean;
}

export interface FileItem {
  id: number;
  filename: string;
  author: string;
  size: number;
  compressed_size: number;
  encoding: string;
  description: string;
  tags: string;
  tag_ids: string;
  last_read_line: number;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileListResult {
  total_count: number;
  files: FileItem[];
}

interface UseFilesReturn {
  files: FileItem[];
  totalCount: number;
  loading: boolean;
  filter: FileFilter;
  sortBy: string;
  sortOrder: string;
  selectedIds: Set<number>;
  setFilter: (f: FileFilter) => void;
  setSortBy: (col: string) => void;
  toggleSortOrder: () => void;
  setSearch: (query: string) => void;
  toggleSelect: (id: number, multi?: boolean) => void;
  selectRange: (toId: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  fetchFiles: (offset: number, limit: number) => Promise<FileListResult>;
}

export function useFiles(): UseFilesReturn {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FileFilter>({});
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);

  const fetchFiles = useCallback(async (offset: number, limit: number): Promise<FileListResult> => {
    setLoading(true);
    try {
      const result = await invoke<FileListResult>('list_files', {
        filter,
        offset,
        limit,
        sortBy,
        sortOrder,
      });
      if (offset === 0) {
        setFiles(result.files);
      } else {
        setFiles(prev => [...prev, ...result.files]);
      }
      setTotalCount(result.total_count);
      return result;
    } finally {
      setLoading(false);
    }
  }, [filter, sortBy, sortOrder]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  const setSearch = useCallback((query: string) => {
    setFilter(prev => ({ ...prev, filenameQuery: query || undefined }));
  }, []);

  const toggleSelect = useCallback((id: number, multi = false) => {
    setSelectedIds(prev => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClickedId(id);
  }, []);

  const selectRange = useCallback((toId: number) => {
    if (lastClickedId === null) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      const ids = files.map(f => f.id);
      const fromIdx = ids.indexOf(lastClickedId);
      const toIdx = ids.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return next;
      const [start, end] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
      for (let i = start; i <= end; i++) {
        next.add(ids[i]);
      }
      return next;
    });
  }, [lastClickedId, files]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(files.map(f => f.id)));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    files, totalCount, loading, filter, sortBy, sortOrder, selectedIds,
    setFilter, setSortBy, toggleSortOrder, setSearch,
    toggleSelect, selectRange, selectAll, clearSelection,
    fetchFiles,
  };
}
