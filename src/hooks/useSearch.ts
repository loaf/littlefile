import { useState, useCallback, useRef } from 'react';

export interface SearchMatch {
  lineIndex: number;
  startChar: number;
  endChar: number;
}

export interface SearchState {
  query: string;
  matches: SearchMatch[];
  currentIndex: number;
  caseSensitive: boolean;
  wholeWord: boolean;
}

interface UseSearchReturn {
  search: SearchState;
  setSearchQuery: (query: string) => void;
  setCaseSensitive: (v: boolean) => void;
  setWholeWord: (v: boolean) => void;
  goToNextMatch: () => void;
  goToPrevMatch: () => void;
  clearSearch: () => void;
  getHighlightedHtml: (htmlLine: string, lineIndex: number, currentPageRange: { start: number; end: number }) => string;
  currentMatchLine: number | null;
}

export function useSearch(htmlLines: string[]): UseSearchReturn {
  const [search, setSearch] = useState<SearchState>({
    query: '',
    matches: [],
    currentIndex: -1,
    caseSensitive: false,
    wholeWord: false,
  });

  const htmlLinesRef = useRef(htmlLines);
  htmlLinesRef.current = htmlLines;

  const performSearch = useCallback((query: string, caseSensitive: boolean, wholeWord: boolean) => {
    if (!query.trim()) {
      setSearch({ query: '', matches: [], currentIndex: -1, caseSensitive, wholeWord });
      return;
    }

    const lines = htmlLinesRef.current;
    const matches: SearchMatch[] = [];
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = caseSensitive ? lines[i] : lines[i].toLowerCase();
      let pos = 0;
      while (pos < line.length) {
        const found = line.indexOf(searchQuery, pos);
        if (found === -1) break;

        if (wholeWord) {
          const before = found > 0 ? line[found - 1] : ' ';
          const after = found + searchQuery.length < line.length
            ? line[found + searchQuery.length] : ' ';
          const isWordBoundary = /[^a-zA-Z0-9\u4e00-\u9fff]/.test(before)
            && /[^a-zA-Z0-9\u4e00-\u9fff]/.test(after);
          if (!isWordBoundary) {
            pos = found + 1;
            continue;
          }
        }

        matches.push({
          lineIndex: i,
          startChar: found,
          endChar: found + searchQuery.length,
        });
        pos = found + 1;
      }
    }

    setSearch({
      query,
      matches,
      currentIndex: matches.length > 0 ? 0 : -1,
      caseSensitive,
      wholeWord,
    });
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    performSearch(query, search.caseSensitive, search.wholeWord);
  }, [search.caseSensitive, search.wholeWord, performSearch]);

  const setCaseSensitive = useCallback((v: boolean) => {
    performSearch(search.query, v, search.wholeWord);
  }, [search.query, search.wholeWord, performSearch]);

  const setWholeWord = useCallback((v: boolean) => {
    performSearch(search.query, search.caseSensitive, v);
  }, [search.query, search.caseSensitive, performSearch]);

  const goToNextMatch = useCallback(() => {
    setSearch(prev => ({
      ...prev,
      currentIndex: prev.matches.length > 0
        ? (prev.currentIndex + 1) % prev.matches.length
        : -1,
    }));
  }, []);

  const goToPrevMatch = useCallback(() => {
    setSearch(prev => ({
      ...prev,
      currentIndex: prev.matches.length > 0
        ? (prev.currentIndex - 1 + prev.matches.length) % prev.matches.length
        : -1,
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setSearch({ query: '', matches: [], currentIndex: -1, caseSensitive: false, wholeWord: false });
  }, []);

  const currentMatchLine = search.matches.length > 0 && search.currentIndex >= 0
    ? search.matches[search.currentIndex].lineIndex
    : null;

  const getHighlightedHtml = useCallback((
    htmlLine: string,
    lineIndex: number,
    _currentPageRange: { start: number; end: number },
  ): string => {
    if (search.query === '' || search.matches.length === 0) return htmlLine;

    const lineMatches = search.matches.filter(m => m.lineIndex === lineIndex);
    if (lineMatches.length === 0) return htmlLine;

    const sorted = [...lineMatches].sort((a, b) => b.startChar - a.startChar);

    let result = htmlLine;
    for (const m of sorted) {
      const matchText = result.substring(m.startChar, m.endChar);
      const isCurrent = search.currentIndex >= 0 && search.matches[search.currentIndex] === m;
      const cls = isCurrent ? 'search-active' : 'search-highlight';
      result = result.substring(0, m.startChar)
        + `<mark class="${cls}">${matchText}</mark>`
        + result.substring(m.endChar);
    }

    return result;
  }, [search]);

  return {
    search,
    setSearchQuery,
    setCaseSensitive,
    setWholeWord,
    goToNextMatch,
    goToPrevMatch,
    clearSearch,
    getHighlightedHtml,
    currentMatchLine,
  };
}
