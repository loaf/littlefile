import { useState, useEffect } from 'react';
import { AutoComplete, Tag, Space, message } from 'antd';
import { invoke } from '@tauri-apps/api/core';

interface TagData {
  id: number;
  name: string;
  file_count: number;
  created_at: string;
}

interface TagInputProps {
  fileIds: number[];
  initialTagIds: number[];
  onTagsChanged?: () => void;
}

export default function TagInput({ fileIds, initialTagIds, onTagsChanged }: TagInputProps) {
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<number[]>(initialTagIds);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<TagData[]>('list_tags')
      .then(setAllTags)
      .catch((err) => {
        console.error('Failed to load tags:', err);
      });
  }, []);

  useEffect(() => {
    setAssignedTagIds(initialTagIds);
  }, [initialTagIds]);

  const assignedTags = allTags.filter(t => assignedTagIds.includes(t.id));
  const unassignedTags = allTags.filter(t => !assignedTagIds.includes(t.id));

  const filteredOptions = unassignedTags
    .filter(t => t.name.toLowerCase().includes(inputValue.toLowerCase()))
    .map(t => ({
      value: String(t.id),
      label: t.name,
    }));

  const isNewTag = inputValue.trim() !== '' && !allTags.some(
    t => t.name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  if (isNewTag) {
    filteredOptions.push({
      value: `new:${inputValue.trim()}`,
      label: `创建 "${inputValue.trim()}"`,
    });
  }

  const handleSelect = async (value: string) => {
    if (fileIds.length === 0) return;
    setLoading(true);
    try {
      if (value.startsWith('new:')) {
        const name = value.slice(4);
        const newTag = await invoke<TagData>('create_tag', { name });
        setAllTags(prev => [...prev, newTag]);
        await invoke('add_tags_to_files', { fileIds, tagIds: [newTag.id] });
        setAssignedTagIds(prev => [...prev, newTag.id]);
      } else {
        const tagId = Number(value);
        await invoke('add_tags_to_files', { fileIds, tagIds: [tagId] });
        setAssignedTagIds(prev => [...prev, tagId]);
      }
      setInputValue('');
      onTagsChanged?.();
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (tagId: number) => {
    if (fileIds.length === 0) return;
    setLoading(true);
    try {
      await invoke('remove_tags_from_files', { fileIds, tagIds: [tagId] });
      setAssignedTagIds(prev => prev.filter(id => id !== tagId));
      onTagsChanged?.();
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Space size={[4, 4]} wrap style={{ marginBottom: 8 }}>
        {assignedTags.map(tag => (
          <Tag
            key={tag.id}
            closable={!loading}
            onClose={(e) => {
              e.preventDefault();
              handleRemove(tag.id);
            }}
            style={{ margin: 0 }}
          >
            {tag.name}
          </Tag>
        ))}
      </Space>
      <AutoComplete
        style={{ width: '100%' }}
        value={inputValue}
        options={filteredOptions}
        onChange={setInputValue}
        onSelect={handleSelect}
        placeholder="添加标签..."
        disabled={loading}
        filterOption={false}
      />
    </div>
  );
}
