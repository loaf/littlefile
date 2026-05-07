import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Space, Typography, Skeleton, Checkbox, Tag, Tooltip, Dropdown, Input, message, Modal } from 'antd';
import { AppstoreOutlined, CheckCircleOutlined, FileOutlined, DeleteOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { useFiles } from '../../hooks/useFiles';
import type { FileItem, FileFilter } from '../../hooks/useFiles';

const { Text } = Typography;
const PAGE_SIZE = 50;

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  sortable: boolean;
  render: (item: FileItem) => ReactNode;
}

const INITIAL_COLUMNS: ColumnDef[] = [
  { key: 'filename', label: '文件名', width: 320, sortable: true, render: (item) => (
    <Space size={4}>
      {item.is_read ? <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 11 }} /> : <FileOutlined style={{ color: '#999', fontSize: 11 }} />}
      <Text strong>{item.filename}</Text>
    </Space>
  ) },
  { key: 'author', label: '作者', width: 120, sortable: true, render: (item) => <Text type="secondary">{item.author || '-'}</Text> },
  { key: 'size', label: '大小', width: 100, sortable: true, render: (item) => formatFileSize(item.size) },
  { key: 'description', label: '描述', width: 200, sortable: false, render: (item) => <Text type="secondary" ellipsis>{item.description || '-'}</Text> },
  { key: 'tags', label: '标签', width: 150, sortable: false, render: (item) => renderTags(item.tags) },
  { key: 'encoding', label: '编码', width: 80, sortable: false, render: (item) => <Tag>{item.encoding}</Tag> },
  { key: 'created_at', label: '导入时间', width: 140, sortable: true, render: (item) => <Text type="secondary">{item.created_at?.slice(0, 10) || '-'}</Text> },
];

export default function LibraryList({ onOpenFile, filter }: { onOpenFile?: (id: number) => void; filter: FileFilter }) {
  const {
    files, totalCount, loading, sortBy, sortOrder, selectedIds,
    setSortBy, toggleSortOrder, toggleSelect, selectRange,
    clearSelection, fetchFiles,
  } = useFiles();

  useEffect(() => {
    setLoadedOffset(0);
    fetchFiles(0, PAGE_SIZE, filter).then(() => setLoadedOffset(PAGE_SIZE));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [loadedOffset, setLoadedOffset] = useState(0);

  const handleLoadMore = () => {
    if (files.length < totalCount && !loading) {
      fetchFiles(loadedOffset, PAGE_SIZE).then(() => setLoadedOffset(prev => prev + PAGE_SIZE));
    }
  };

  const rowVirtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const [columns, setColumns] = useState(INITIAL_COLUMNS);
  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ srcIdx: number; currentIdx: number } | null>(null);

  // Column resize via mousemove
  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      setColumns(prev => prev.map(c =>
        c.key === resizing.key ? { ...c, width: Math.max(60, resizing.startWidth + e.clientX - resizing.startX) } : c
      ));
    };
    const onUp = () => setResizing(null);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [resizing]);

  // Column drag reorder via custom mouse events (more reliable than HTML5 DnD in WebView)
  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: MouseEvent) => {
      if (!headerRef.current) return;
      const headerEl = headerRef.current;
      const headers = Array.from(headerEl.querySelectorAll<HTMLElement>('[data-col-idx]'));
      let newIdx = dragState.srcIdx;
      for (let i = 0; i < headers.length; i++) {
        const rect = headers[i].getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          newIdx = i;
          break;
        }
      }
      if (newIdx !== dragState.currentIdx) {
        setDragState(prev => prev ? { ...prev, currentIdx: newIdx } : null);
      }
    };
    const onUp = () => {
      setDragState(prev => {
        if (prev && prev.srcIdx !== prev.currentIdx) {
          setColumns(cols => {
            const next = [...cols];
            const [moved] = next.splice(prev.srcIdx, 1);
            next.splice(prev.currentIdx, 0, moved);
            return next;
          });
        }
        return null;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragState?.srcIdx]); // only re-bind when a new drag starts

  const handleColumnClick = (col: ColumnDef) => {
    if (!col.sortable) return;
    if (sortBy === col.key) {
      toggleSortOrder();
    } else {
      setSortBy(col.key);
    }
  };

  const handleRowClick = (item: FileItem, e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectRange(item.id);
    } else {
      toggleSelect(item.id, e.ctrlKey || e.metaKey);
    }
  };

  const handleOpenExternal = useCallback(async (fileId: number) => {
    try {
      await invoke('open_with_external_app', { id: fileId });
    } catch (e) {
      console.error('Failed to open externally:', e);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        if (selectedIds.size === 1) {
          const fileId = [...selectedIds][0];
          handleOpenExternal(fileId);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, handleOpenExternal]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedIds.size > 0 && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        const ids = [...selectedIds];
        Modal.confirm({
          title: '确认删除', content: `确定要删除选中的 ${ids.length} 个文件吗？`, okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
          onOk: async () => { try { await invoke('delete_files', { fileIds: ids }); clearSelection(); fetchFiles(0, PAGE_SIZE); } catch (e) { message.error(String(e)); } },
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, clearSelection, fetchFiles]);

  const handleUpdateDescription = useCallback(async (id: number, description: string) => {
    try {
      await invoke('update_description', { id, description });
    } catch (e) {
      message.error(String(e));
    }
  }, []);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={headerRef}
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          padding: '4px 0',
          background: 'var(--bg-secondary)',
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        <div style={{ width: 40, flexShrink: 0 }} />
        {columns.map((col, idx) => {
          const isDragging = dragState?.srcIdx === idx;
          const isDropTarget = dragState && dragState.currentIdx === idx && dragState.srcIdx !== idx;
          const isDragActive = dragState !== null;
          return (
            <div
              key={col.key}
              data-col-idx={idx}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                const target = e.target as HTMLElement;
                if (target.closest('[data-resize-handle]')) return;
                setDragState({ srcIdx: idx, currentIdx: idx });
              }}
              onClick={() => { if (!isDragActive) handleColumnClick(col); }}
              style={{
                width: col.width, flexShrink: 0,
                cursor: isDragActive ? 'grabbing' : col.sortable ? 'pointer' : 'default',
                padding: '8px 12px', fontWeight: 600, userSelect: 'none',
                position: 'relative',
                borderRight: '1px solid var(--border-color)',
                opacity: isDragging ? 0.4 : 1,
                borderLeft: isDropTarget ? '3px solid #1677ff' : undefined,
                transition: 'opacity 0.15s, border-left 0.15s',
              }}
            >
              <Space size={2}>
                {col.label}
                {sortBy === col.key && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
              </Space>
              <div
                data-resize-handle
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setResizing({ key: col.key, startX: e.clientX, startWidth: col.width }); }}
                style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 8, cursor: 'col-resize', zIndex: 1 }}
              />
            </div>
          );
        })}
      </div>

      <div
        ref={parentRef}
        style={{ flex: 1, overflow: 'auto' }}
        onScroll={(e) => {
          const target = e.currentTarget;
          if (target.scrollHeight - target.scrollTop - target.clientHeight < 200) {
            handleLoadMore();
          }
        }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const item = files[virtualRow.index];
            if (!item) return null;
            return (
               <Dropdown
                 key={item.id}
                 menu={{
                   items: [
                     {
                       key: 'open-default',
                       label: '用系统默认程序打开',
                       icon: <AppstoreOutlined />,
                       onClick: () => handleOpenExternal(item.id),
                     },
                     { type: 'divider' },
                     {
                       key: 'delete',
                       label: '删除文件',
                       icon: <DeleteOutlined />,
                       danger: true,
                       onClick: () => {
                         Modal.confirm({
                           title: '确认删除',
                           content: '确定要删除此文件吗？',
                           okText: '删除',
                           cancelText: '取消',
                           okButtonProps: { danger: true },
                           onOk: async () => {
                             try {
                               await invoke('delete_files', { fileIds: [item.id] });
                               fetchFiles(0, PAGE_SIZE);
                             } catch (e) {
                               message.error(String(e));
                             }
                           },
                         });
                       },
                     },
                   ],
                 }}
                 trigger={['contextMenu']}
               >
                <div
                   onClick={(e) => handleRowClick(item, e)}
                   onDoubleClick={() => onOpenFile?.(item.id)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 0',
                    background: selectedIds.has(item.id)
                      ? 'var(--highlight-bg)'
                      : virtualRow.index % 2 === 0
                        ? 'var(--bg-primary)'
                        : 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: 40, flexShrink: 0, textAlign: 'center' }}>
                    <Checkbox checked={selectedIds.has(item.id)} />
                  </div>
                  {columns.map(col => (
                    <div
                      key={col.key}
                      style={{ width: col.width, flexShrink: 0, padding: '0 12px', overflow: 'hidden' }}
                    >
                      {col.key === 'description'
                        ? <EditableDescriptionCell item={item} onSave={handleUpdateDescription} />
                        : col.render(item)
                      }
                    </div>
                  ))}
                </div>
              </Dropdown>
            );
          })}
        </div>
        {loading && (
          <Skeleton active paragraph={{ rows: 3 }} style={{ padding: 12 }} />
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): ReactNode {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function renderTags(tagsStr: string): ReactNode {
  if (!tagsStr) return <Text type="secondary">-</Text>;
  const tagList = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
  if (tagList.length === 0) return <Text type="secondary">-</Text>;
  return (
    <Tooltip title={tagsStr}>
      <Space size={2} wrap>
        {tagList.slice(0, 2).map(tag => <Tag key={tag}>{tag}</Tag>)}
        {tagList.length > 2 && <Text type="secondary">+{tagList.length - 2}</Text>}
      </Space>
    </Tooltip>
  );
}

function EditableDescriptionCell({
  item,
  onSave,
}: {
  item: FileItem;
  onSave: (id: number, description: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.description);
  const [saving, setSaving] = useState(false);

  // External data may change; sync when not actively editing
  if (!editing && value !== item.description) {
    setValue(item.description);
  }

  const handleSave = async () => {
    const trimmed = value.slice(0, 500);
    if (trimmed === item.description) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(item.id, trimmed);
      setEditing(false);
    } catch {
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Input
        size="small"
        value={value}
        onChange={e => setValue(e.target.value)}
        onPressEnter={handleSave}
        onBlur={handleSave}
        disabled={saving}
        maxLength={500}
        autoFocus
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <Text
      type="secondary"
      ellipsis
      style={{ cursor: 'pointer' }}
      onClick={e => {
        e.stopPropagation();
        setValue(item.description);
        setEditing(true);
      }}
    >
      {item.description || '-'}
    </Text>
  );
}
