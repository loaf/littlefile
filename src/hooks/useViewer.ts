import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ProcessedBook, TitleEntry } from '../reader/engine';

interface FileReadingData {
  id: number;
  content: string;
  encoding: string;
  filename: string;
  author: string;
  last_read_line: number;
  is_read: boolean;
}

interface UseViewerReturn {
  loading: boolean;
  processing: boolean;
  book: ProcessedBook | null;
  fileData: FileReadingData | null;
  currentPage: number;
  totalPages: number;
  error: string | null;
  openFile: (fileId: number) => Promise<void>;
  closeFile: () => void;
  goToPage: (page: number) => void;
  goToNextChapter: () => void;
  goToPrevChapter: () => void;
  goToTitle: (title: TitleEntry) => void;
  getVisibleLines: () => { html: string; startLine: number; endLine: number };
}

export function useViewer(): UseViewerReturn {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [book, setBook] = useState<ProcessedBook | null>(null);
  const [fileData, setFileData] = useState<FileReadingData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const totalPages = book ? book.pageBreaks.length + 1 : 0;

  const openFile = useCallback(async (fileId: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<FileReadingData>('get_file_content_for_reading', { id: fileId });
      setFileData(data);
      setProcessing(true);

      const worker = new Worker(
        new URL('../reader/engine.worker.ts', import.meta.url),
        { type: 'module' },
      );
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'complete') {
          setBook(msg.book);
          setProcessing(false);
          setLoading(false);
          setCurrentPage(0);
        } else if (msg.type === 'first-chunk') {
          setBook(msg.book);
        } else if (msg.type === 'error') {
          setError(msg.error);
          setProcessing(false);
          setLoading(false);
        }
      };

      worker.postMessage({
        id: String(fileId),
        content: data.content,
        encoding: data.encoding,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, []);

  const closeFile = useCallback(() => {
    if (book && fileData) {
      const startLine = currentPage === 0 ? 0 : (book.pageBreaks[currentPage - 1] || 0);
      invoke('save_reading_progress', { id: fileData.id, lastReadLine: startLine }).catch(() => {
        // Silently ignore progress save failures
      });
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    setBook(null);
    setFileData(null);
    setCurrentPage(0);
    setError(null);
  }, [book, fileData, currentPage]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  const goToNextChapter = useCallback(() => {
    if (!book) return;
    const currentLine = book.pageBreaks[currentPage] || 0;
    const next = book.titles.find(t => t.lineNumber > currentLine);
    if (next) {
      const idx = book.pageBreaks.findIndex(b => b > next.lineNumber);
      if (idx >= 0) goToPage(idx);
    }
  }, [book, currentPage, goToPage]);

  const goToPrevChapter = useCallback(() => {
    if (!book) return;
    const currentLine = book.pageBreaks[currentPage - 1] || 0;
    const prev = [...book.titles].reverse().find(t => t.lineNumber < currentLine);
    if (prev) {
      const idx = book.pageBreaks.findIndex(b => b > prev.lineNumber);
      if (idx >= 0) goToPage(idx);
    }
  }, [book, currentPage, goToPage]);

  const goToTitle = useCallback((title: TitleEntry) => {
    if (!book) return;
    const idx = book.pageBreaks.findIndex(b => b > title.lineNumber);
    goToPage(idx >= 0 ? idx : 0);
  }, [book, goToPage]);

  const getVisibleLines = useCallback(() => {
    if (!book || book.pageBreaks.length === 0) return { html: '', startLine: 0, endLine: 0 };
    const start = currentPage === 0 ? 0 : book.pageBreaks[currentPage - 1];
    const end = currentPage < book.pageBreaks.length
      ? book.pageBreaks[currentPage]
      : book.htmlLines.length;
    return {
      html: book.htmlLines.slice(start, end).join('\n'),
      startLine: start,
      endLine: end,
    };
  }, [book, currentPage]);

  return {
    loading, processing, book, fileData, currentPage, totalPages, error,
    openFile, closeFile, goToPage, goToNextChapter, goToPrevChapter, goToTitle, getVisibleLines,
  };
}
