import { useState, useEffect } from 'react';
import { Input, Typography, Badge, Dropdown, Space, Modal, message } from 'antd';
import { SearchOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import type { FileFilter } from '../../hooks/useFiles';
import TagFilter from '../tags/TagFilter';
import FilterPanel from '../search/FilterPanel';

const { Text } = Typography;

interface TagInfo {
  id: number;
  name: string;
  file_count: number;
  created_at: string;
}

interface SidebarProps {
  filter: FileFilter;
  onFilterChange: (filter: FileFilter) => void;
  tags?: TagInfo[];
  onTagClick?: (tagId: number) => void;
}

export default function Sidebar({ filter, onFilterChange }: SidebarProps) {
  const selectedTagIds = filter.tagIds ?? [];
  const noTagsSelected = selectedTagIds.length === 0;

  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const fetchTags = async () => {
    try {
      const tags = await invoke<TagInfo[]>('list_tags');
      setAllTags(tags);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleTagClick = (tagId: number) => {
    const newTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId];
    onFilterChange({
      ...filter,
      tagIds: newTagIds.length > 0 ? newTagIds : undefined,
    });
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      await invoke('create_tag', { name });
      setNewTagName('');
      setShowNewTagInput(false);
      await fetchTags();
    } catch (e) {
      message.error(String(e));
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      await invoke('delete_tag', { id: tagId });
      await fetchTags();
      if (selectedTagIds.includes(tagId)) {
        const updated = selectedTagIds.filter(id => id !== tagId);
        onFilterChange({
          ...filter,
          tagIds: updated.length > 0 ? updated : undefined,
        });
      }
    } catch (e) {
      message.error(String(e));
    }
  };

  const confirmDeleteTag = (tag: TagInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除标签「${tag.name}」吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => handleDeleteTag(tag.id),
    });
  };

  return (
    <div
      style={{
        width: 220,
        height: '100%',
        borderRight: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <Input
        placeholder="搜索文件名..."
        prefix={<SearchOutlined />}
        allowClear
        value={filter.filenameQuery ?? ''}
        onChange={e => onFilterChange({ ...filter, filenameQuery: e.target.value || undefined })}
      />

      <FilterPanel filter={filter} onFilterChange={onFilterChange} />

      <TagFilter
        mode={filter.tagFilterMode ?? 'OR'}
        onChange={mode => onFilterChange({ ...filter, tagFilterMode: mode })}
      />

      <div style={{ flex: 1 }}>
        <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
          标签
        </Text>

        <div
          onClick={() => onFilterChange({ ...filter, tagIds: undefined })}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            cursor: 'pointer',
            background: noTagsSelected ? 'var(--highlight-bg)' : 'transparent',
            fontWeight: noTagsSelected ? 600 : 400,
            marginBottom: 2,
            fontSize: 13,
          }}
        >
          全部
        </div>

        {allTags.length === 0 && (
          <Text type="secondary" style={{ fontSize: 12, padding: '8px 0', display: 'block' }}>
            暂无标签
          </Text>
        )}

        {allTags.map(tag => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <Dropdown
              key={tag.id}
              menu={{
                items: [
                  {
                    key: 'delete',
                    label: '删除标签',
                    icon: <DeleteOutlined />,
                    danger: true,
                    onClick: () => confirmDeleteTag(tag),
                  },
                ],
              }}
              trigger={['contextMenu']}
            >
              <div
                onClick={() => handleTagClick(tag.id)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isSelected ? 'var(--highlight-bg)' : 'transparent',
                  fontWeight: isSelected ? 600 : 400,
                  marginBottom: 2,
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{tag.name}</span>
                <Badge
                  count={tag.file_count}
                  style={{ backgroundColor: '#bbb' }}
                  size="small"
                />
              </div>
            </Dropdown>
          );
        })}
      </div>

      {showNewTagInput ? (
        <Input
          autoFocus
          size="small"
          placeholder="标签名称"
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          onPressEnter={handleCreateTag}
          onBlur={() => {
            if (!newTagName.trim()) setShowNewTagInput(false);
          }}
          style={{ marginTop: 'auto', flexShrink: 0 }}
        />
      ) : (
        <div
          onClick={() => setShowNewTagInput(true)}
          style={{
            marginTop: 'auto',
            padding: '6px 0',
            cursor: 'pointer',
            color: 'var(--highlight-text)',
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <Space size={4}>
            <PlusOutlined />
            新建标签
          </Space>
        </div>
      )}
    </div>
  );
}
