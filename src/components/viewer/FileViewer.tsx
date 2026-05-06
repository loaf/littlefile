import { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Spin, Typography, Space, Tag } from 'antd';
import { ArrowLeftOutlined, LeftOutlined, RightOutlined, ExportOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { useViewer } from '../../hooks/useViewer';
import { useSearch } from '../../hooks/useSearch';
import TOCPanel from './TOCPanel';
import PaginationBar from './PaginationBar';
import MetaPanel from './MetaPanel';
import SearchBar from './SearchBar';
import Footnotes from './Footnotes';
import FontSelector from './FontSelector';

const { Text, Title: AntTitle } = Typography;

interface FileViewerProps {
  fileId: number;
  onClose: () => void;
}

export default function FileViewer({ fileId, onClose }: FileViewerProps) {
  const {
    loading, processing, book, fileData, currentPage, totalPages, error,
    openFile, closeFile, goToPage, goToNextChapter, goToPrevChapter, goToTitle, getVisibleLines,
  } = useViewer();

  useEffect(() => {
    openFile(fileId);
    return () => { closeFile(); };
  }, [fileId]);

  const [showSearch, setShowSearch] = useState(false);
  const [fontFamily, setFontFamily] = useState('"Microsoft YaHei", sans-serif');

  // Auto-jump to saved reading position on book load
  const hasRestoredPosition = useRef(false);
  useEffect(() => {
    if (!book || hasRestoredPosition.current) return;
    const lastReadLine = fileData?.last_read_line;
    if (lastReadLine && lastReadLine > 0) {
      const targetPage = book.pageBreaks.findIndex(b => b > lastReadLine);
      if (targetPage >= 0) {
        goToPage(targetPage);
      }
    }
    hasRestoredPosition.current = true;
  }, [book, fileData, goToPage]);

  // Auto mark as read when reaching last page
  const markedReadRef = useRef(false);
  useEffect(() => {
    if (!book || !fileData || processing || markedReadRef.current) return;
    if (currentPage >= totalPages - 1 && totalPages > 0) {
      markedReadRef.current = true;
      invoke('mark_as_read', { id: fileId }).catch((err: unknown) => {
        console.warn('Failed to mark as read:', err);
      });
    }
  }, [book, fileData, currentPage, totalPages, processing, fileId]);

  const htmlLines = book?.htmlLines ?? [];
  const {
    search,
    setSearchQuery,
    setCaseSensitive,
    setWholeWord,
    goToNextMatch,
    goToPrevMatch,
    clearSearch,
    getHighlightedHtml,
    currentMatchLine,
  } = useSearch(htmlLines);

  const handleOpenExternal = useCallback(async () => {
    if (!fileData) return;
    try {
      await invoke('open_with_external_app', { id: fileData.id });
    } catch (e) {
      console.error('Failed to open externally:', e);
    }
  }, [fileData]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
      e.preventDefault();
      handleOpenExternal();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
    }
    if (e.key === 'Escape' && showSearch) {
      e.preventDefault();
      setShowSearch(false);
      clearSearch();
    }
  }, [showSearch, clearSearch, handleOpenExternal]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cross-page navigation: jump to the page containing the current match
  const scrollToMatchRef = useRef(false);
  useEffect(() => {
    if (!book || currentMatchLine === null || search.matches.length === 0) return;
    const currentPageStart = currentPage === 0 ? 0 : book.pageBreaks[currentPage - 1];
    const currentPageEnd = currentPage < book.pageBreaks.length
      ? book.pageBreaks[currentPage]
      : book.htmlLines.length;

    if (currentMatchLine < currentPageStart || currentMatchLine >= currentPageEnd) {
      const targetPage = book.pageBreaks.findIndex(b => b > currentMatchLine);
      if (targetPage >= 0) {
        goToPage(targetPage);
        scrollToMatchRef.current = true;
      }
    }
  }, [currentMatchLine, book, currentPage, goToPage]);

  const handleBack = () => {
    closeFile();
    onClose();
  };

  const currentLine = book
    ? (currentPage === 0 ? 0 : (book.pageBreaks[currentPage - 1] || 0))
    : 0;

  if (loading && !book) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text type="danger">{error}</Text>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>返回</Button>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          borderBottom: '1px solid var(--border-color)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: 'var(--bg-secondary)',
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回
        </Button>

        <Text strong ellipsis style={{ flex: 1, textAlign: 'center', padding: '0 12px', fontSize: 14 }}>
          {fileData?.filename ?? ''}
          {fileData?.is_read && (
            <Tag color="green" style={{ fontSize: 10, marginLeft: 6 }}>已读</Tag>
          )}
        </Text>

        <Space>
          <FontSelector value={fontFamily} onChange={setFontFamily} />
          <Button
            type="text"
            size="small"
            icon={<LeftOutlined />}
            onClick={goToPrevChapter}
            disabled={!book || book.titles.length === 0}
          >
            上一章
          </Button>
          <Button
            type="text"
            size="small"
            onClick={goToNextChapter}
            disabled={!book || book.titles.length === 0}
          >
            下一章
            <RightOutlined />
          </Button>
          <Button
            type="text"
            size="small"
            icon={<ExportOutlined />}
            onClick={handleOpenExternal}
            title="用外部程序打开 (Ctrl+Shift+O)"
          >
            外部打开
          </Button>
        </Space>
      </div>

      {showSearch && book && (
        <SearchBar
          query={search.query}
          matchCount={search.matches.length}
          currentIndex={search.currentIndex}
          caseSensitive={search.caseSensitive}
          wholeWord={search.wholeWord}
          processing={processing}
          onQueryChange={setSearchQuery}
          onNext={goToNextMatch}
          onPrev={goToPrevMatch}
          onToggleCase={() => setCaseSensitive(!search.caseSensitive)}
          onToggleWord={() => setWholeWord(!search.wholeWord)}
          onClose={() => { setShowSearch(false); clearSearch(); }}
        />
      )}

      {showSearch && (
        <style>{`
          mark.search-highlight { background-color: #FFEB3B; color: inherit; padding: 0 1px; border-radius: 2px; }
          mark.search-active { background-color: #FF9800; color: white; padding: 0 1px; border-radius: 2px; }
        `}</style>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {book && (
          <TOCPanel
            titles={book.titles}
            currentLine={currentLine}
            onTitleClick={goToTitle}
          />
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {processing && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, gap: 8 }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12 }}>正在处理...</Text>
            </div>
          )}

          {book && currentPage === 0 && fileData && (
            <div style={{ textAlign: 'center', padding: '32px 24px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <AntTitle level={3} style={{ marginBottom: 4 }}>{fileData.filename}</AntTitle>
              {fileData.author && <Text type="secondary">{fileData.author}</Text>}
            </div>
          )}

          <div
            style={{
              flex: 1,
              padding: '16px 24px 32px',
              fontSize: 16,
              lineHeight: 2,
              textAlign: 'justify',
              fontFamily,
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          >
            {(() => {
              if (!book) return <div />;
              const { startLine, endLine } = getVisibleLines();
              const range = { start: startLine, end: endLine };
              const lines: string[] = [];
              for (let i = startLine; i < endLine && i < book.htmlLines.length; i++) {
                lines.push(getHighlightedHtml(book.htmlLines[i], i, range));
              }
              return <div dangerouslySetInnerHTML={{ __html: lines.join('\n') }} />;
            })()}
          </div>
        </div>

        {fileData && (
          <MetaPanel
            filename={fileData.filename}
            author={fileData.author}
            encoding={fileData.encoding}
            fileId={fileId}
            description=""
            tagIds=""
          />
        )}
      </div>

      {book && (
        <PaginationBar
          currentPage={currentPage}
          totalPages={totalPages}
          processing={processing}
          onPageChange={goToPage}
          onPrevPage={() => goToPage(currentPage - 1)}
          onNextPage={() => goToPage(currentPage + 1)}
        />
      )}

      {book && book.footnotes.length > 0 && (() => {
        const { startLine, endLine } = getVisibleLines();
        return (
          <Footnotes
            footnotes={book.footnotes}
            visibleLineRange={[startLine, endLine]}
          />
        );
      })()}
    </div>
  );
}
